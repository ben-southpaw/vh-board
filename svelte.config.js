// import { mdsvex } from 'mdsvex';
import preprocess from 'svelte-preprocess';
import adapter from '@sveltejs/adapter-vercel';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: preprocess({
		scss: {
			prependData: `@import 'src/styles/global.scss';`
		}
	}),
	kit: { adapter: adapter() },
	// preprocess: [mdsvex()],
	extensions: ['.svelte', '.svx']
};

export default config;
