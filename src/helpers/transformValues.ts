function transformField(value: any) {
	if (value.$type === "DateTime") {
		return new Date(value.value);
	}
	return value;
}


export function transformValues(data: any) {
	for (const key in data) {
		if (typeof data[key] === "object") {
			if (data[key].$type) {
				data[key] = transformField(data[key]);
			} else {
				data[key] = transformValues(data[key]);
			}
		}
	}
	return data;
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

export function transformData(data: any) {
	if (!data) {
		return data;
	}
	for (let key in data) {
		if (typeof data[key] === "object") {
			data[key] = transformData(data[key]?.["query"]?.["arguments"]?.["data"]) ?? data[key];
		}
	}
	return data;
}