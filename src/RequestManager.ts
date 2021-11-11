import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from "axios";

interface QueuedRequest {
	reject: (error: AxiosError) => void;
	resolve: (response: AxiosResponse) => void;
	url: string;
}

export class RequestManager {
	protected active: number = 0;
	protected axiosConfig: AxiosRequestConfig = {};
	protected queue: QueuedRequest[] = [];

	constructor(axiosConfig?: AxiosRequestConfig) {
		if (axiosConfig) this.axiosConfig = axiosConfig;
	}

	public async push<T = any>(url: string): Promise<AxiosResponse<T>> {
		if (this.active >= 5) {
			return new Promise((resolve, reject) => {
				this.queue.push({ reject, resolve, url });
			});
		} else return this.fire(url);
	}

	protected async fire(url: string): Promise<AxiosResponse> {
		this.active++;
		const response = await axios.get(url, this.axiosConfig);
		this.active--;

		const queuedRequest = this.queue.shift();
		
		if (queuedRequest) {
			this.fire(queuedRequest.url)
				.then(queuedRequest.resolve)
				.catch(queuedRequest.reject);
		}

		return response;
	}
}