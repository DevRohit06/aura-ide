/**
 * Template Dependency Resolver Service
 * Service for resolving and managing template dependencies
 */

import { logger } from '$lib/utils/logger.js';

export interface DependencyInfo {
	name: string;
	version: string;
	type: 'runtime' | 'dev' | 'peer';
	isOptional: boolean;
	description?: string;
	homepage?: string;
	repository?: string;
	license?: string;
	size?: number;
}

export interface DependencyTree {
	[dependency: string]: {
		version: string;
		dependencies?: DependencyTree;
		resolved?: boolean;
		error?: string;
	};
}

export interface PackageInfo {
	name: string;
	version: string;
	description?: string;
	main?: string;
	scripts?: Record<string, string>;
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	peerDependencies?: Record<string, string>;
	keywords?: string[];
	author?: string;
	license?: string;
	repository?: any;
	homepage?: string;
}

/**
 * Template Dependency Resolver Service Class
 */
export class TemplateDependencyResolverService {
	private npmRegistry = 'https://registry.npmjs.org';
	private dependencyCache = new Map<string, DependencyInfo>();

	/**
	 * Resolve dependencies from package.json
	 */
	async resolveDependencies(packageJson: PackageInfo): Promise<DependencyInfo[]> {
		try {
			const dependencies: DependencyInfo[] = [];

			// Runtime dependencies
			if (packageJson.dependencies) {
				for (const [name, version] of Object.entries(packageJson.dependencies)) {
					const info = await this.getDependencyInfo(name, version);
					dependencies.push({
						...info,
						type: 'runtime',
						isOptional: false
					});
				}
			}

			// Dev dependencies
			if (packageJson.devDependencies) {
				for (const [name, version] of Object.entries(packageJson.devDependencies)) {
					const info = await this.getDependencyInfo(name, version);
					dependencies.push({
						...info,
						type: 'dev',
						isOptional: true
					});
				}
			}

			// Peer dependencies
			if (packageJson.peerDependencies) {
				for (const [name, version] of Object.entries(packageJson.peerDependencies)) {
					const info = await this.getDependencyInfo(name, version);
					dependencies.push({
						...info,
						type: 'peer',
						isOptional: true
					});
				}
			}

			return dependencies;
		} catch (error) {
			logger.error('Failed to resolve dependencies:', error);
			throw error;
		}
	}

	/**
	 * Build dependency tree
	 */
	async buildDependencyTree(packageJson: PackageInfo, maxDepth = 3): Promise<DependencyTree> {
		try {
			const tree: DependencyTree = {};

			const resolveDeps = async (
				deps: Record<string, string>,
				depth: number
			): Promise<DependencyTree> => {
				if (depth >= maxDepth) {
					return {};
				}

				const result: DependencyTree = {};

				for (const [name, version] of Object.entries(deps)) {
					try {
						const packageInfo = await this.getPackageInfo(name, version);
						result[name] = {
							version: packageInfo.version,
							resolved: true
						};

						// Recursively resolve nested dependencies
						if (packageInfo.dependencies && Object.keys(packageInfo.dependencies).length > 0) {
							result[name].dependencies = await resolveDeps(packageInfo.dependencies, depth + 1);
						}
					} catch (error) {
						result[name] = {
							version,
							resolved: false,
							error: error instanceof Error ? error.message : 'Unknown error'
						};
					}
				}

				return result;
			};

			// Build tree for each dependency type
			if (packageJson.dependencies) {
				const runtimeTree = await resolveDeps(packageJson.dependencies, 0);
				Object.assign(tree, runtimeTree);
			}

			return tree;
		} catch (error) {
			logger.error('Failed to build dependency tree:', error);
			throw error;
		}
	}

	/**
	 * Get dependency information
	 */
	async getDependencyInfo(name: string, version: string): Promise<DependencyInfo> {
		const cacheKey = `${name}@${version}`;

		// Check cache first
		if (this.dependencyCache.has(cacheKey)) {
			return this.dependencyCache.get(cacheKey)!;
		}

		try {
			const packageInfo = await this.getPackageInfo(name, version);

			const info: DependencyInfo = {
				name: packageInfo.name,
				version: packageInfo.version,
				type: 'runtime', // Will be overridden by caller
				isOptional: false, // Will be overridden by caller
				description: packageInfo.description,
				homepage: packageInfo.homepage,
				repository:
					typeof packageInfo.repository === 'string'
						? packageInfo.repository
						: packageInfo.repository?.url,
				license: packageInfo.license
			};

			// Cache the result
			this.dependencyCache.set(cacheKey, info);

			return info;
		} catch (error) {
			logger.error(`Failed to get dependency info for ${name}@${version}:`, error);

			// Return minimal info on error
			const fallbackInfo: DependencyInfo = {
				name,
				version,
				type: 'runtime',
				isOptional: false
			};

			return fallbackInfo;
		}
	}

	/**
	 * Get package information from npm registry
	 */
	async getPackageInfo(name: string, version?: string): Promise<PackageInfo> {
		try {
			const url =
				version && version !== 'latest'
					? `${this.npmRegistry}/${name}/${version}`
					: `${this.npmRegistry}/${name}/latest`;

			const response = await fetch(url);

			if (!response.ok) {
				throw new Error(`NPM registry error: ${response.status}`);
			}

			return await response.json();
		} catch (error) {
			logger.error(`Failed to get package info for ${name}:`, error);
			throw error;
		}
	}

	/**
	 * Validate dependency versions
	 */
	validateVersions(dependencies: DependencyInfo[]): {
		valid: DependencyInfo[];
		invalid: Array<{ dependency: DependencyInfo; reason: string }>;
	} {
		const valid: DependencyInfo[] = [];
		const invalid: Array<{ dependency: DependencyInfo; reason: string }> = [];

		for (const dependency of dependencies) {
			if (!this.isValidVersion(dependency.version)) {
				invalid.push({
					dependency,
					reason: 'Invalid version format'
				});
				continue;
			}

			if (this.isDeprecatedVersion(dependency.version)) {
				invalid.push({
					dependency,
					reason: 'Deprecated version'
				});
				continue;
			}

			valid.push(dependency);
		}

		return { valid, invalid };
	}

	/**
	 * Find conflicting dependencies
	 */
	findConflicts(dependencies: DependencyInfo[]): Array<{
		name: string;
		versions: string[];
		types: string[];
	}> {
		const dependencyMap = new Map<string, { versions: Set<string>; types: Set<string> }>();

		// Group dependencies by name
		for (const dependency of dependencies) {
			if (!dependencyMap.has(dependency.name)) {
				dependencyMap.set(dependency.name, {
					versions: new Set(),
					types: new Set()
				});
			}

			const entry = dependencyMap.get(dependency.name)!;
			entry.versions.add(dependency.version);
			entry.types.add(dependency.type);
		}

		// Find conflicts (same dependency with different versions)
		const conflicts: Array<{ name: string; versions: string[]; types: string[] }> = [];

		for (const [name, entry] of dependencyMap.entries()) {
			if (entry.versions.size > 1) {
				conflicts.push({
					name,
					versions: Array.from(entry.versions),
					types: Array.from(entry.types)
				});
			}
		}

		return conflicts;
	}

	/**
	 * Optimize dependencies by removing duplicates and conflicting versions
	 */
	optimizeDependencies(dependencies: DependencyInfo[]): {
		optimized: DependencyInfo[];
		removed: DependencyInfo[];
		conflicts: Array<{ name: string; versions: string[] }>;
	} {
		const optimized: DependencyInfo[] = [];
		const removed: DependencyInfo[] = [];
		const dependencyMap = new Map<string, DependencyInfo[]>();

		// Group dependencies by name
		for (const dependency of dependencies) {
			if (!dependencyMap.has(dependency.name)) {
				dependencyMap.set(dependency.name, []);
			}
			dependencyMap.get(dependency.name)!.push(dependency);
		}

		const conflicts: Array<{ name: string; versions: string[] }> = [];

		// Resolve conflicts by keeping the most recent version
		for (const [name, deps] of dependencyMap.entries()) {
			if (deps.length === 1) {
				optimized.push(deps[0]);
			} else {
				// Sort by version and keep the highest (most recent)
				const sorted = deps.sort((a, b) => this.compareVersions(a.version, b.version));
				const latest = sorted[sorted.length - 1];

				optimized.push(latest);
				removed.push(...sorted.slice(0, -1));

				conflicts.push({
					name,
					versions: deps.map((d) => d.version)
				});
			}
		}

		return { optimized, removed, conflicts };
	}

	/**
	 * Get dependency size information
	 */
	async getDependencySize(name: string, version: string): Promise<number | null> {
		try {
			// This would typically query a service like bundlephobia.com
			// For now, we'll return a mock size
			const mockSizes: Record<string, number> = {
				react: 45000,
				vue: 35000,
				svelte: 10000,
				angular: 80000,
				lodash: 25000,
				moment: 67000,
				axios: 15000
			};

			return mockSizes[name] || null;
		} catch (error) {
			logger.error(`Failed to get size for ${name}@${version}:`, error);
			return null;
		}
	}

	/**
	 * Check if version format is valid
	 */
	private isValidVersion(version: string): boolean {
		// Basic semver validation
		const semverRegex =
			/^(\^|~|>=|<=|>|<)?(\d+)\.(\d+)\.(\d+)(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/;
		return semverRegex.test(version) || version === 'latest' || version === '*';
	}

	/**
	 * Check if version is deprecated
	 */
	private isDeprecatedVersion(version: string): boolean {
		// This would typically check against a list of deprecated versions
		// For now, we'll check for very old versions
		const majorVersion = parseInt(version.replace(/[^\d.]/, ''));
		return majorVersion < 1;
	}

	/**
	 * Compare version strings
	 */
	private compareVersions(a: string, b: string): number {
		const parseVersion = (version: string) => {
			const cleaned = version.replace(/[^\d.]/g, '');
			return cleaned.split('.').map(Number);
		};

		const versionA = parseVersion(a);
		const versionB = parseVersion(b);

		for (let i = 0; i < Math.max(versionA.length, versionB.length); i++) {
			const numA = versionA[i] || 0;
			const numB = versionB[i] || 0;

			if (numA !== numB) {
				return numA - numB;
			}
		}

		return 0;
	}

	/**
	 * Clear dependency cache
	 */
	clearCache(): void {
		this.dependencyCache.clear();
		logger.info('Dependency cache cleared');
	}

	/**
	 * Get cache statistics
	 */
	getCacheStats(): {
		size: number;
		entries: Array<{ name: string; version: string }>;
	} {
		const entries = Array.from(this.dependencyCache.keys()).map((key) => {
			const [name, version] = key.split('@');
			return { name, version };
		});

		return {
			size: this.dependencyCache.size,
			entries
		};
	}
}

/**
 * Singleton template dependency resolver service instance
 */
export const templateDependencyResolverService = new TemplateDependencyResolverService();
