import {DMMF} from "@prisma/client/runtime/library";
import {getDMMF} from "@prisma/internals";
import fs from "fs";
import {RequestBody} from "../index.js";

const dmmf = await getDMMF({
	datamodel: fs.readFileSync("./prisma/schema.prisma", "utf-8"),
})

function getModel(modelName: string) {
	return dmmf.datamodel.models.find(model => model.name === modelName);
}

function transformField(field: DMMF.Field, value: any) {
	if (field.type === "DateTime") {
		return new Date(value.value);
	}
	return value;
}


export function transformValues(body: RequestBody) {
	const model = getModel(body.modelName);
	if (!model) {
		throw new Error(`Model ${body.modelName} not found`);
	}
	const data = body.query.arguments.data;
	for (const field of model.fields) {
		if (!data[field.name]) {
			continue;
		}
		if (field.relationName) {
			data[field.name] = transformValues({
				modelName: field.type,
				action: "create",
				query: {
					arguments: {
						data: data[field.name],
					}
				}
			})
		} else {
			data[field.name] = transformField(field, data[field.name]);
		}
	}
	return body;
}

export function transformSelection(selection: any) {
	if (!selection) {
		return selection;
	}
	for (let key in selection) {
		if (key === "selection") {
			selection.select = selection[key];
			delete selection[key];
			key = "select"
		} else if (key === "arguments") {
			delete selection[key];
		}
		if (typeof selection[key] === "object") {
			selection[key] = transformSelection(selection[key]);
		}
	}
	return selection;
}