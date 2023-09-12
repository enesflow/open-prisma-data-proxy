import {RequestBodySingle} from "index";

export function transformAction(body: RequestBodySingle) {
	if (body.action.endsWith("One")) {
		body.action = body.action.slice(0, -3);
	}
	return body;
}

export function transformSingleAction(action: string) {
	if (action.endsWith("One")) {
		action = action.slice(0, -3);
	}
	return action;
}

/**
 * @example
 * joinAction("findUnique", "User") // "findUniqueUser"
 * joinAction("findMany", "User") // "findManyUser"
 * joinAction("findFirstOrThrow", "User") // "findFirstUserOrThrow"
 * joinAction("findFirst", "User") // "findFirstUser"
 * joinAction("findUniqueOrThrow", "User") // "findUniqueUserOrThrow"
 * @param action
 * @param modelName
 */
export function joinAction(action: string,  modelName: string) {
	if (action.endsWith("OrThrow")) {
		action = action.slice(0, -7);
		return `${action}${modelName}OrThrow`;
	}
	return `${action}${modelName}`;
}