export namespace DataForSeo {
	export namespace Serp {
		export interface Response<T = Task> {
			version: string;
			status_code: number;
			status_message: string;
			time: string;
			cost: number;
			tasks_count: number;
			tasks_error: number;
			tasks: T[];
		}

		export interface Task {
			id: string;
			status_code: number;
			status_message: string;
			time: string;
			cost: number;
			result_count: number;
			path: string[];
			data: Data; // data sent to the task
			result: null | Result[]; // result data - null if task is not completed
		}

		export interface Data {
			api: string;
			function: string;
			se: string;
			se_type: string;
			keyword: string;
			location_code: number;
			language_code: string;
			priority: number;
			postback_data: string;
			postback_url: string;
			device: string;
			os: string;
		}

		export interface Result {
			keyword: string;
			type: string;
			se_domain: string;
			location_code: number;
			language_code: string;
			check_url: string;
			datetime: string;
			spell: string | null;
			refinement_chips: string | null;
			item_types: string[];
			se_results_count: number;
			items_count: number;
			items: Item[];
		}

		export interface Item {
			type: string;
			rank_group: number;
			rank_absolute: number;
			domain: string;
			title: string;
			description: string;
			url: string;
			breadcrumb: string;
		}

		export type TaskReadyResponse = Response<TaskReady>;

		export interface TaskReady {
			id: string;
			se: string; // 'google' | 'bing' | ...
			se_type: string; // 'organic' | ...
			date_posted: string;
			tag: string;
			endpoint_regular: string; // ex: '/v3/serp/google/organic/task_get/regular/09291301-1103-0066-0000-263212284b04'
			endpoint_advanced: string; // ex: '/v3/serp/google/organic/task_get/advanced/09291301-1103-0066-0000-263212284b04',
			endpoint_html: string; // ex: '/v3/serp/google/organic/task_get/html/09291301-1103-0066-0000-263212284b04'
		}
	}
}
