import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import adapter from "svelte-adapter-bun";

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({

		}),
		// OAuth token exchanges are server-to-server form submissions and normally
		// do not include an Origin header. Authentication for application mutations
		// is enforced with explicit bearer tokens rather than ambient cookies.
		csrf: {
			trustedOrigins: ["*"],
		},
		experimental: {
			remoteFunctions: true,
		},
	},
	compilerOptions: {
		experimental: {
			async: true,
		},
    warningFilter: (warning) => {
      const ignore = [
        'a11y_media_has_caption',
        'a11y_no_redundant_roles',
        'a11y_consider_explicit_label',
        'a11y_no_noninteractive_tabindex',
        'a11y_click_events_have_key_events',
        'a11y_no_static_element_interactions',
        'a11y_no_noninteractive_element_interactions',
        'a11y_missing_attribute',
      ]
      return !ignore.includes(warning.code)
    }
	},
};

export default config;
