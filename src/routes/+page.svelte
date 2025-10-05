<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '@iconify/svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Collapsible from '$lib/components/ui/collapsible';

	let mounted = $state(false);
	let scrollY = $state(0);

	onMount(() => {
		mounted = true;

		const handleScroll = () => {
			scrollY = window.scrollY;
		};

		window.addEventListener('scroll', handleScroll);
		return () => window.removeEventListener('scroll', handleScroll);
	});

	const features = [
		{
			icon: 'lucide:sparkles',
			title: 'AI-Powered Development',
			description:
				'Context-aware code completion, intelligent debugging, and real-time optimization suggestions powered by cutting-edge AI models.'
		},
		{
			icon: 'lucide:cloud',
			title: 'Cloud-Native Architecture',
			description:
				'Access your development environment from anywhere. No setup, no configuration - just code.'
		},
		{
			icon: 'lucide:box',
			title: 'Isolated Sandbox Execution',
			description:
				'Secure, containerized environments via Daytona and E2B. Test without worrying about breaking production.'
		},
		{
			icon: 'lucide:code-2',
			title: 'Advanced Code Editor',
			description:
				'Built on CodeMirror 6 with syntax highlighting, IntelliSense, and multi-language support.'
		},
		{
			icon: 'lucide:zap',
			title: 'Live Preview & Hot Reload',
			description:
				'Instant application preview with automatic reloading. See your changes in real-time.'
		},
		{
			icon: 'lucide:terminal',
			title: 'Integrated Terminal',
			description:
				'Full-featured terminal with real-time streaming. Run commands, debug, and monitor your applications.'
		},
		{
			icon: 'lucide:database',
			title: 'Persistent Storage',
			description:
				'Cloudflare R2 integration ensures your projects are safely stored and versioned.'
		},
		{
			icon: 'lucide:git-branch',
			title: 'Git Integration',
			description:
				'Seamless Git workflow with branch management, commits, and GitHub/GitLab integration.'
		},
		{
			icon: 'lucide:users',
			title: 'Real-Time Collaboration',
			description:
				'Work together with your team in real-time. Share sessions and code together.'
		}
	];

	const technologies = [
		{ name: 'SvelteKit 5', icon: 'simple-icons:svelte' },
		{ name: 'TypeScript', icon: 'simple-icons:typescript' },
		{ name: 'Tailwind CSS', icon: 'simple-icons:tailwindcss' },
		{ name: 'MongoDB', icon: 'simple-icons:mongodb' },
		{ name: 'OpenAI', icon: 'simple-icons:openai' },
		{ name: 'Anthropic', icon: 'simple-icons:anthropic' },
		{ name: 'Node.js', icon: 'simple-icons:nodedotjs' },
		{ name: 'Docker', icon: 'simple-icons:docker' }
	];

	const stats = [
		{ value: '99.9%', label: 'Uptime', icon: 'lucide:shield-check' },
		{ value: '<100ms', label: 'Response Time', icon: 'lucide:gauge' },
		{ value: '50+', label: 'Frameworks', icon: 'lucide:layers' },
		{ value: '24/7', label: 'Support', icon: 'lucide:headphones' }
	];

	const faqs = [
		{
			question: 'What is Aura IDE Cloud?',
			answer:
				'Aura IDE Cloud is a professional cloud-based integrated development environment that combines AI-powered code assistance with isolated sandbox execution. It allows you to code from anywhere without any setup, featuring real-time collaboration, intelligent debugging, and seamless integration with popular frameworks.'
		},
		{
			question: 'How does AI-powered development work?',
			answer:
				'Our AI integration leverages OpenAI and Anthropic models to provide context-aware code completion, intelligent error detection, and optimization suggestions. The AI analyzes your entire project context to deliver relevant and accurate assistance, making your development workflow faster and more efficient.'
		},
		{
			question: 'What are sandbox environments?',
			answer:
				'Sandbox environments are isolated, containerized development spaces powered by Daytona and E2B. They provide a secure testing ground where you can run and test your code without affecting your production environment. Each sandbox is fully configured with the necessary dependencies and tools.'
		},
		{
			question: 'Is my code and data secure?',
			answer:
				'Yes, security is our top priority. We use enterprise-grade encryption, secure sandbox isolation, and Cloudflare R2 for persistent storage. Your code is stored with version control, and all data transmission is encrypted. We comply with industry-standard security practices and offer 99.9% uptime guarantee.'
		},
		{
			question: 'Which programming languages and frameworks are supported?',
			answer:
				'Aura IDE supports 50+ frameworks including React, Vue, Angular, Svelte, Next.js, Node.js, Python, Django, Flask, and many more. Our CodeMirror 6-based editor provides syntax highlighting and IntelliSense for all major programming languages including JavaScript, TypeScript, Python, Go, Rust, and more.'
		},
		{
			question: 'Can I collaborate with my team in real-time?',
			answer:
				'Yes! Aura IDE includes real-time collaboration features that allow multiple developers to work on the same project simultaneously. You can share sessions, see live cursor positions, and chat with team members directly within the IDE.'
		},
		{
			question: 'Do I need to install anything?',
			answer:
				'No installation required! Aura IDE is completely cloud-based. All you need is a web browser and an internet connection. Your entire development environment, including dependencies and tools, is managed in the cloud.'
		},
		{
			question: 'What is your pricing model?',
			answer:
				'We offer a free tier to get started with no credit card required. Our paid plans scale based on usage and include additional features like increased storage, priority support, and advanced AI capabilities. Visit our pricing page for detailed information about our plans.'
		}
	];

	let openFaqIndex = $state<number | null>(null);

	function toggleFaq(index: number) {
		openFaqIndex = openFaqIndex === index ? null : index;
	}
</script>

<svelte:head>
	<title>Aura IDE Cloud - AI-Powered Development Environment</title>
	<meta
		name="description"
		content="Professional cloud IDE with AI assistance, real-time collaboration, and isolated sandbox execution. Code smarter, faster, and from anywhere."
	/>
</svelte:head>

<main class="landing">
	<!-- Hero Section -->
	<section class="hero">
		<div class="hero-background" style="transform: translateY({scrollY * 0.3}px)"></div>
		<div class="container">
			<div class="hero-content" class:animate={mounted}>
				<div class="badge">
					<Icon icon="lucide:sparkles" width="16" />
					<span>Powered by AI</span>
				</div>
				<h1>Professional Cloud IDE</h1>
				<h2 class="hero-subtitle">for Modern Development</h2>
				<p class="subtitle">
					Build, test, and deploy with AI-powered assistance. Experience cloud-native development
					with isolated sandbox execution, real-time collaboration, and intelligent code completion.
				</p>
				<div class="cta-group">
					<Button href="/auth/register" size="lg" class="gap-2">
						<span>Get Started Free</span>
						<Icon icon="lucide:arrow-right" width="20" />
					</Button>
					<Button href="/dashboard" variant="outline" size="lg" class="gap-2">
						<Icon icon="lucide:layout-dashboard" width="20" />
						<span>View Dashboard</span>
					</Button>
				</div>
				<div class="trust-indicators">
					<Icon icon="lucide:check-circle" width="16" />
					<span>No credit card required</span>
					<span class="separator">•</span>
					<Icon icon="lucide:shield" width="16" />
					<span>Enterprise-grade security</span>
				</div>
			</div>
		</div>
		<div class="scroll-indicator" class:hide={scrollY > 100}>
			<Icon icon="lucide:chevron-down" width="24" />
		</div>
	</section>

	<!-- Stats Section -->
	<section class="stats-section">
		<div class="container">
			<div class="stats-grid">
				{#each stats as stat}
					<div class="stat-card">
						<Icon icon={stat.icon} width="32" />
						<div class="stat-value">{stat.value}</div>
						<div class="stat-label">{stat.label}</div>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- Features Section -->
	<section class="features">
		<div class="container">
			<div class="section-header">
				<h2>Everything You Need to Code</h2>
				<p>A complete development environment in the cloud with professional-grade tools</p>
			</div>
			<div class="feature-grid">
				{#each features as feature, i}
					<div
						class="feature-card"
						style="animation-delay: {i * 0.1}s"
						class:visible={mounted}
					>
						<div class="feature-icon-wrapper">
							<Icon icon={feature.icon} width="28" />
						</div>
						<h3>{feature.title}</h3>
						<p>{feature.description}</p>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- Technology Stack Section -->
	<section class="tech-stack">
		<div class="container">
			<div class="section-header">
				<h2>Built with Modern Technologies</h2>
				<p>Leveraging industry-leading tools and frameworks</p>
			</div>
			<div class="tech-grid">
				{#each technologies as tech}
					<div class="tech-card">
						<Icon icon={tech.icon} width="40" />
						<span>{tech.name}</span>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- FAQ Section -->
	<section class="faq-section">
		<div class="container">
			<div class="section-header">
				<h2>Frequently Asked Questions</h2>
				<p>Everything you need to know about Aura IDE</p>
			</div>
			<div class="faq-container">
				{#each faqs as faq, i}
					<div class="faq-item">
						<Collapsible.Root open={openFaqIndex === i}>
							<Collapsible.Trigger
								class="faq-trigger"
								onclick={() => toggleFaq(i)}
							>
								<h3 class="faq-question">{faq.question}</h3>
								<Icon
									icon="lucide:chevron-down"
									width="20"
									class="faq-icon {openFaqIndex === i ? 'rotate' : ''}"
								/>
							</Collapsible.Trigger>
							<Collapsible.Content class="faq-answer-wrapper">
								<p class="faq-answer">{faq.answer}</p>
							</Collapsible.Content>
						</Collapsible.Root>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- CTA Section -->
	<section class="cta-section">
		<div class="container">
			<div class="cta-content">
				<Icon icon="lucide:rocket" width="48" />
				<h2>Ready to Transform Your Development Workflow?</h2>
				<p>Join developers who are already coding smarter with Aura IDE</p>
				<div class="cta-buttons">
					<Button href="/auth/register" size="lg" class="gap-2">
						<span>Start Coding Now</span>
						<Icon icon="lucide:arrow-right" width="20" />
					</Button>
					<Button href="/auth/login" variant="outline" size="lg" class="gap-2">
						<span>Sign In</span>
					</Button>
				</div>
			</div>
		</div>
	</section>

	<!-- Footer -->
	<footer class="footer">
		<div class="container">
			<div class="footer-content">
				<div class="footer-brand">
					<h3>Aura IDE</h3>
					<p>Professional cloud development environment powered by AI</p>
				</div>
				<div class="footer-links">
					<div class="footer-column">
						<h4>Product</h4>
						<a href="/dashboard">Dashboard</a>
						<a href="/features">Features</a>
						<a href="/pricing">Pricing</a>
					</div>
					<div class="footer-column">
						<h4>Resources</h4>
						<a href="/docs">Documentation</a>
						<a href="/api">API Reference</a>
						<a href="/support">Support</a>
					</div>
					<div class="footer-column">
						<h4>Company</h4>
						<a href="/about">About</a>
						<a href="/blog">Blog</a>
						<a href="/contact">Contact</a>
					</div>
				</div>
			</div>
			<div class="footer-bottom">
				<p>&copy; {new Date().getFullYear()} Aura IDE. All rights reserved.</p>
				<div class="footer-legal">
					<a href="/privacy">Privacy Policy</a>
					<span>•</span>
					<a href="/terms">Terms of Service</a>
				</div>
			</div>
		</div>
	</footer>
</main>

<style>
	.landing {
		min-height: 100vh;
		background: #0a0a0a;
		color: #e5e5e5;
		overflow-x: hidden;
	}

	.container {
		max-width: 1280px;
		margin: 0 auto;
		padding: 0 2rem;
	}

	/* Hero Section */
	.hero {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		text-align: center;
		overflow: hidden;
	}

	.hero-background {
		position: absolute;
		inset: 0;
		background: radial-gradient(circle at 50% 0%, rgba(255, 255, 255, 0.03) 0%, transparent 50%),
			radial-gradient(circle at 80% 80%, rgba(255, 255, 255, 0.02) 0%, transparent 40%);
		pointer-events: none;
	}

	.hero-content {
		position: relative;
		z-index: 1;
		opacity: 0;
		transform: translateY(30px);
		transition: all 0.8s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.hero-content.animate {
		opacity: 1;
		transform: translateY(0);
	}

	.badge {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 50px;
		font-size: 0.875rem;
		font-weight: 500;
		color: #d4d4d4;
		margin-bottom: 2rem;
		backdrop-filter: blur(10px);
		transition: all 0.3s ease;
	}

	.badge:hover {
		background: rgba(255, 255, 255, 0.08);
		border-color: rgba(255, 255, 255, 0.15);
	}

	h1 {
		font-size: clamp(3rem, 8vw, 5.5rem);
		font-weight: 800;
		line-height: 1.1;
		margin-bottom: 0.5rem;
		background: linear-gradient(to bottom, #ffffff 30%, #a3a3a3 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		letter-spacing: -0.03em;
	}

	.hero-subtitle {
		font-size: clamp(2rem, 6vw, 4rem);
		font-weight: 800;
		line-height: 1.1;
		margin-bottom: 1.5rem;
		background: linear-gradient(to bottom, #ffffff 30%, #737373 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		letter-spacing: -0.03em;
	}

	.subtitle {
		font-size: clamp(1.05rem, 2vw, 1.25rem);
		font-weight: 400;
		max-width: 700px;
		margin: 0 auto 3rem;
		color: #a3a3a3;
		line-height: 1.7;
	}

	.cta-group {
		display: flex;
		gap: 1rem;
		justify-content: center;
		flex-wrap: wrap;
		margin-bottom: 2rem;
	}

	.trust-indicators {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		font-size: 0.875rem;
		color: #737373;
	}

	.separator {
		color: #404040;
	}

	.scroll-indicator {
		position: absolute;
		bottom: 2rem;
		left: 50%;
		transform: translateX(-50%);
		color: #525252;
		animation: bounce 2s infinite;
		transition: opacity 0.3s ease;
	}

	.scroll-indicator.hide {
		opacity: 0;
		pointer-events: none;
	}

	@keyframes bounce {
		0%,
		100% {
			transform: translateX(-50%) translateY(0);
		}
		50% {
			transform: translateX(-50%) translateY(10px);
		}
	}

	/* Stats Section */
	.stats-section {
		padding: 4rem 0;
		background: linear-gradient(to bottom, #0a0a0a 0%, #0f0f0f 100%);
		border-top: 1px solid rgba(255, 255, 255, 0.05);
		border-bottom: 1px solid rgba(255, 255, 255, 0.05);
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 2rem;
	}

	.stat-card {
		text-align: center;
		padding: 1.5rem;
		border-radius: 12px;
		background: rgba(255, 255, 255, 0.02);
		border: 1px solid rgba(255, 255, 255, 0.05);
		transition: all 0.3s ease;
	}

	.stat-card:hover {
		background: rgba(255, 255, 255, 0.04);
		border-color: rgba(255, 255, 255, 0.1);
		transform: translateY(-4px);
	}

	.stat-card :global(svg) {
		color: #ffffff;
		opacity: 0.7;
		margin-bottom: 0.75rem;
	}

	.stat-value {
		font-size: 2.5rem;
		font-weight: 800;
		color: #ffffff;
		margin-bottom: 0.25rem;
	}

	.stat-label {
		font-size: 0.875rem;
		color: #737373;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	/* Features Section */
	.features {
		padding: 8rem 0;
		background: #0f0f0f;
	}

	.section-header {
		text-align: center;
		margin-bottom: 5rem;
	}

	.section-header h2 {
		font-size: clamp(2.5rem, 5vw, 3.5rem);
		font-weight: 700;
		margin-bottom: 1rem;
		color: #ffffff;
		letter-spacing: -0.02em;
	}

	.section-header p {
		font-size: 1.125rem;
		color: #737373;
		max-width: 600px;
		margin: 0 auto;
	}

	.feature-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
		gap: 2rem;
	}

	.feature-card {
		background: rgba(255, 255, 255, 0.02);
		padding: 2.5rem;
		border-radius: 16px;
		border: 1px solid rgba(255, 255, 255, 0.08);
		transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
		opacity: 0;
		transform: translateY(20px);
	}

	.feature-card.visible {
		animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
	}

	@keyframes fadeInUp {
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.feature-card:hover {
		background: rgba(255, 255, 255, 0.04);
		border-color: rgba(255, 255, 255, 0.15);
		transform: translateY(-6px);
		box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
	}

	.feature-icon-wrapper {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 60px;
		height: 60px;
		background: rgba(255, 255, 255, 0.05);
		border-radius: 12px;
		border: 1px solid rgba(255, 255, 255, 0.1);
		margin-bottom: 1.5rem;
		color: #ffffff;
		transition: all 0.3s ease;
	}

	.feature-card:hover .feature-icon-wrapper {
		background: rgba(255, 255, 255, 0.1);
		border-color: rgba(255, 255, 255, 0.2);
		transform: scale(1.1);
	}

	.feature-card h3 {
		font-size: 1.375rem;
		font-weight: 600;
		margin-bottom: 0.75rem;
		color: #ffffff;
	}

	.feature-card p {
		color: #a3a3a3;
		line-height: 1.7;
		font-size: 0.9375rem;
	}

	/* Technology Stack Section */
	.tech-stack {
		padding: 8rem 0;
		background: linear-gradient(to bottom, #0f0f0f 0%, #0a0a0a 100%);
		border-top: 1px solid rgba(255, 255, 255, 0.05);
	}

	.tech-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 1.5rem;
		max-width: 900px;
		margin: 0 auto;
	}

	.tech-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		padding: 2rem 1.5rem;
		background: rgba(255, 255, 255, 0.02);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 12px;
		transition: all 0.3s ease;
		color: #a3a3a3;
	}

	.tech-card:hover {
		background: rgba(255, 255, 255, 0.05);
		border-color: rgba(255, 255, 255, 0.15);
		transform: translateY(-4px);
		color: #ffffff;
	}

	.tech-card :global(svg) {
		opacity: 0.7;
		transition: opacity 0.3s ease;
	}

	.tech-card:hover :global(svg) {
		opacity: 1;
	}

	.tech-card span {
		font-size: 0.875rem;
		font-weight: 500;
	}

	/* FAQ Section */
	.faq-section {
		padding: 8rem 0;
		background: #0a0a0a;
		border-top: 1px solid rgba(255, 255, 255, 0.05);
	}

	.faq-container {
		max-width: 800px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.faq-item {
		background: rgba(255, 255, 255, 0.02);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 12px;
		overflow: hidden;
		transition: all 0.3s ease;
	}

	.faq-item:hover {
		background: rgba(255, 255, 255, 0.04);
		border-color: rgba(255, 255, 255, 0.12);
	}

	:global(.faq-trigger) {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.5rem 2rem;
		background: transparent;
		border: none;
		cursor: pointer;
		text-align: left;
		transition: all 0.3s ease;
	}

	:global(.faq-trigger:hover) {
		background: rgba(255, 255, 255, 0.02);
	}

	.faq-question {
		font-size: 1.125rem;
		font-weight: 600;
		color: #ffffff;
		margin: 0;
		padding-right: 2rem;
	}

	:global(.faq-icon) {
		color: #a3a3a3;
		transition: transform 0.3s ease, color 0.3s ease;
		flex-shrink: 0;
	}

	:global(.faq-icon.rotate) {
		transform: rotate(180deg);
		color: #ffffff;
	}

	:global(.faq-answer-wrapper) {
		overflow: hidden;
	}

	.faq-answer {
		padding: 0 2rem 1.5rem 2rem;
		color: #a3a3a3;
		line-height: 1.7;
		font-size: 0.9375rem;
		margin: 0;
	}

	/* CTA Section */
	.cta-section {
		padding: 8rem 0;
		background: linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 100%);
		border-top: 1px solid rgba(255, 255, 255, 0.05);
		position: relative;
		overflow: hidden;
	}

	.cta-section::before {
		content: '';
		position: absolute;
		top: -50%;
		left: -50%;
		width: 200%;
		height: 200%;
		background: radial-gradient(circle, rgba(255, 255, 255, 0.03) 0%, transparent 70%);
		animation: rotate 20s linear infinite;
	}

	@keyframes rotate {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	.cta-content {
		position: relative;
		text-align: center;
		z-index: 1;
	}

	.cta-content :global(svg) {
		color: #ffffff;
		margin-bottom: 2rem;
		opacity: 0.9;
	}

	.cta-content h2 {
		font-size: clamp(2rem, 4vw, 3rem);
		font-weight: 700;
		margin-bottom: 1rem;
		color: #ffffff;
		letter-spacing: -0.02em;
	}

	.cta-content p {
		font-size: 1.125rem;
		color: #a3a3a3;
		margin-bottom: 2.5rem;
	}

	.cta-buttons {
		display: flex;
		gap: 1rem;
		justify-content: center;
		flex-wrap: wrap;
	}

	/* Footer */
	.footer {
		background: #0a0a0a;
		border-top: 1px solid rgba(255, 255, 255, 0.05);
		padding: 4rem 0 2rem;
	}

	.footer-content {
		display: grid;
		grid-template-columns: 2fr 1fr 1fr 1fr;
		gap: 3rem;
		margin-bottom: 3rem;
	}

	.footer-brand h3 {
		font-size: 1.5rem;
		font-weight: 700;
		color: #ffffff;
		margin-bottom: 0.75rem;
	}

	.footer-brand p {
		color: #737373;
		line-height: 1.6;
		max-width: 300px;
	}

	.footer-column h4 {
		font-size: 0.875rem;
		font-weight: 600;
		color: #ffffff;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 1rem;
	}

	.footer-column a {
		display: block;
		color: #737373;
		text-decoration: none;
		margin-bottom: 0.75rem;
		transition: color 0.3s ease;
	}

	.footer-column a:hover {
		color: #ffffff;
	}

	.footer-bottom {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding-top: 2rem;
		border-top: 1px solid rgba(255, 255, 255, 0.05);
		color: #525252;
		font-size: 0.875rem;
	}

	.footer-legal {
		display: flex;
		gap: 1rem;
		align-items: center;
	}

	.footer-legal a {
		color: #737373;
		text-decoration: none;
		transition: color 0.3s ease;
	}

	.footer-legal a:hover {
		color: #ffffff;
	}

	/* Responsive Design */
	@media (max-width: 1024px) {
		.footer-content {
			grid-template-columns: 1fr 1fr;
		}

		.footer-brand {
			grid-column: 1 / -1;
		}
	}

	@media (max-width: 768px) {
		.container {
			padding: 0 1.5rem;
		}

		.cta-group,
		.cta-buttons {
			flex-direction: column;
			align-items: stretch;
		}

		.feature-grid,
		.tech-grid {
			grid-template-columns: 1fr;
		}

		.footer-content {
			grid-template-columns: 1fr;
		}

		.footer-bottom {
			flex-direction: column;
			gap: 1rem;
			text-align: center;
		}

		.trust-indicators {
			flex-direction: column;
			gap: 0.5rem;
		}

		.separator {
			display: none;
		}

		:global(.faq-trigger) {
			padding: 1.25rem 1.5rem;
		}

		.faq-question {
			font-size: 1rem;
			padding-right: 1rem;
		}

		.faq-answer {
			padding: 0 1.5rem 1.25rem 1.5rem;
		}
	}
</style>
