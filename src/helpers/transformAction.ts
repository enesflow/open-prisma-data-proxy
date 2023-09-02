import {RequestBody} from "../index.js";

export function transformAction(body: RequestBody) {
	if (body.action.endsWith("One")) {
		body.action = body.action.slice(0, -3);
	}
	return body;
}