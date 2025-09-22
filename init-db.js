import { MongoClient } from 'mongodb';

// Simple database test using the same configuration as the auth system
const MONGODB_URI =
	process.env.DATABASE_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017/aura-dev';
const DATABASE_NAME = process.env.MONGODB_DB_NAME || 'aura-dev';

async function createBasicCollections() {
	const client = new MongoClient(MONGODB_URI);

	try {
		await client.connect();
		console.log('✅ Connected to MongoDB');

		const db = client.db(DATABASE_NAME);

		// Create basic sandbox collections
		const collections = [
			'project_templates',
			'template_dependencies',
			'project_storage',
			'sandbox_sessions',
			'code_executions',
			'sandbox_file_changes',
			'template_cache',
			'sandbox_usage_analytics'
		];

		console.log('Creating collections...');

		for (const collectionName of collections) {
			try {
				await db.createCollection(collectionName);
				console.log(`✅ Created collection: ${collectionName}`);
			} catch (error) {
				if (error.message.includes('already exists')) {
					console.log(`ℹ️  Collection already exists: ${collectionName}`);
				} else {
					console.error(`❌ Error creating ${collectionName}:`, error.message);
				}
			}
		}

		// Create some basic indexes
		console.log('Creating indexes...');

		// Project templates indexes
		const templatesCollection = db.collection('project_templates');
		await templatesCollection.createIndex({ type: 1 });
		await templatesCollection.createIndex({ category: 1 });
		await templatesCollection.createIndex({ is_active: 1 });
		await templatesCollection.createIndex({ popularity_score: -1 });
		console.log('✅ Created project_templates indexes');

		// Project storage indexes
		const storageCollection = db.collection('project_storage');
		await storageCollection.createIndex({ project_id: 1 }, { unique: true });
		await storageCollection.createIndex({ storage_provider: 1 });
		await storageCollection.createIndex({ upload_status: 1 });
		console.log('✅ Created project_storage indexes');

		// Sandbox sessions indexes
		const sessionsCollection = db.collection('sandbox_sessions');
		await sessionsCollection.createIndex({ user_id: 1 });
		await sessionsCollection.createIndex({ project_id: 1 });
		await sessionsCollection.createIndex({ status: 1 });
		await sessionsCollection.createIndex({ last_activity: 1 });
		console.log('✅ Created sandbox_sessions indexes');

		// Get collection stats
		console.log('\n📊 Collection Statistics:');
		for (const collectionName of collections) {
			const collection = db.collection(collectionName);
			const count = await collection.countDocuments();
			const indexes = await collection.indexes();
			console.log(`  ${collectionName}: ${count} documents, ${indexes.length} indexes`);
		}

		console.log('\n🎉 Database initialization completed successfully!');
	} catch (error) {
		console.error('❌ Database initialization failed:', error);
		throw error;
	} finally {
		await client.close();
		console.log('📪 Database connection closed');
	}
}

createBasicCollections();
