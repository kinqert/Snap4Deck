export function getURLFromTemplates(template, properties) {
	if (!template || !template.length) {
		return null;
	}

	if (Array.isArray(template)) {
		let urls = [];
		for (let temp of template) {
			urls.push(getURLFromTemplate(temp, properties));
		}
		return urls;
	}
	return getURLFromTemplate(template, properties);
}

export function getURLFromTemplate(template, properties) {
	if (!template || !template.length) {
		return null;
	}

	const { x, y, z } = properties.index;
	if (Array.isArray(template)) {
		const index = Math.abs(x + y) % template.length;
		template = template[index];
	}
	const { bbox } = properties;
	if (x && y && z)
		template = template.replace(/\{x\}/g, x)
			.replace(/\{y\}/g, y)
			.replace(/\{z\}/g, z)
			.replace(/\{-y\}/g, Math.pow(2, z) - y - 1)
	if (bbox)
		template = template.replace(
			/\{bbox\}/g,
			`${bbox.west},${bbox.south},${bbox.east},${bbox.north}`
		)
			.replace(
				/\{selection\}/g,
				`${bbox.south};${bbox.west};${bbox.north};${bbox.east}`
			)
			.replace(/\{north\}/g, `${bbox.north}`)
			.replace(/\{south\}/g, `${bbox.south}`)
			.replace(/\{west\}/g, `${bbox.west}`)
			.replace(/\{east\}/g, `${bbox.east}`);
	return template
}

export function urlTemplateToUpdateTrigger(template) {
	if (Array.isArray(template)) {
		return template.join(';');
	}
	return template || '';
}