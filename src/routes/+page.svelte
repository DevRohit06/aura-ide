<script lang="ts">
	import { onMount } from 'svelte';

	let mounted = $state(false);

	onMount(() => {
		mounted = true;
	});
</script>

<svelte:head>
	<title>Aura IDE Cloud - AI-Powered Development Environment</title>
	<meta
		name="description"
		content="Your AI-powered cloud IDE to accelerate coding and debugging with intelligent assistance."
	/>
</svelte:head>

<main class="landing">
	<section class="hero">
		<div class="container">
			<div class="hero-content" class:animate={mounted}>
				<h1>Aura IDE Cloud</h1>
				<p class="subtitle">
					Your AI-powered cloud IDE to accelerate coding and debugging with intelligent assistance.
				</p>
				<div class="cta-group">
					<a href="/dashboard" class="btn btn-primary">Go to Dashboard</a>
					<a href="/auth/register" class="btn btn-secondary">Get Started Free</a>
					<a href="/auth/login" class="btn btn-secondary">Sign In</a>
				</div>
			</div>
		</div>
	</section>

	<section class="features">
		<div class="container">
			<h2>Why Aura IDE Cloud?</h2>
			<div class="feature-grid">
				<div class="feature-card">
					<div class="feature-icon">🤖</div>
					<h3>AI-Powered Coding</h3>
					<p>Intelligent code completion and suggestions based on your entire project context.</p>
				</div>
				<div class="feature-card">
					<div class="feature-icon">☁️</div>
					<h3>Cloud Native</h3>
					<p>Access your development environment from anywhere, no setup required.</p>
				</div>
				<div class="feature-card">
					<div class="feature-icon">🔒</div>
					<h3>Secure Sandbox</h3>
					<p>Test and validate code in isolated environments before deployment.</p>
				</div>
			</div>
		</div>
	</section>
</main>

<style>
	.landing {
		min-height: 100vh;
		background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
		color: #e0e0e0;
	}

	.container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 0 2rem;
	}

	.hero {
		display: flex;
		align-items: center;
		min-height: 100vh;
		text-align: center;
	}

	.hero-content {
		opacity: 0;
		transform: translateY(30px);
		transition: all 0.8s ease-out;
	}

	.hero-content.animate {
		opacity: 1;
		transform: translateY(0);
	}

	h1 {
		font-size: clamp(2.5rem, 6vw, 4rem);
		font-weight: 700;
		margin-bottom: 1.5rem;
		background: linear-gradient(135deg, #ffffff 0%, #a0a0a0 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.subtitle {
		font-size: clamp(1.1rem, 2.5vw, 1.3rem);
		font-weight: 300;
		max-width: 600px;
		margin: 0 auto 2.5rem auto;
		color: #b0b0b0;
		line-height: 1.6;
	}

	.cta-group {
		display: flex;
		gap: 1rem;
		justify-content: center;
		flex-wrap: wrap;
	}

	.btn {
		display: inline-flex;
		align-items: center;
		padding: 0.875rem 2rem;
		border-radius: 8px;
		font-weight: 600;
		font-size: 1rem;
		text-decoration: none;
		transition: all 0.3s ease;
		border: 1px solid transparent;
	}

	.btn-primary {
		background-color: #ffffff;
		color: #0a0a0a;
	}

	.btn-primary:hover {
		background-color: #f0f0f0;
		transform: translateY(-2px);
	}

	.btn-secondary {
		background-color: transparent;
		color: #ffffff;
		border-color: #404040;
	}

	.btn-secondary:hover {
		background-color: #404040;
		border-color: #606060;
		transform: translateY(-2px);
	}

	.features {
		padding: 6rem 0;
		background-color: #111111;
	}

	.features h2 {
		text-align: center;
		font-size: 2.5rem;
		font-weight: 600;
		margin-bottom: 4rem;
		color: #ffffff;
	}

	.feature-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 2rem;
	}

	.feature-card {
		background-color: #1a1a1a;
		padding: 2rem;
		border-radius: 12px;
		text-align: center;
		border: 1px solid #2a2a2a;
		transition: all 0.3s ease;
	}

	.feature-card:hover {
		border-color: #404040;
		transform: translateY(-4px);
	}

	.feature-icon {
		font-size: 3rem;
		margin-bottom: 1rem;
	}

	.feature-card h3 {
		font-size: 1.3rem;
		font-weight: 600;
		margin-bottom: 1rem;
		color: #ffffff;
	}

	.feature-card p {
		color: #b0b0b0;
		line-height: 1.6;
	}

	@media (max-width: 768px) {
		.cta-group {
			flex-direction: column;
			align-items: center;
		}

		.btn {
			width: 200px;
		}
	}
</style>
