export function getURLFromTemplate(template, properties) {
	if (!template || !template.length) {
		return null;
	}

	// supporting deckgl version 8.8
	var x, y, z;
	if (properties.x) {
		({ x, y, z } = properties);
	} else {
		({ x, y, z } = properties.index);
	}

	if (Array.isArray(template)) {
		const index = Math.abs(x + y) % template.length;
		template = template[index];
	}
	const { bbox } = properties;
	return template
		.replace(/\{x\}/g, x)
		.replace(/\{y\}/g, y)
		.replace(/\{z\}/g, z)
		.replace(/\{-y\}/g, Math.pow(2, z) - y - 1)
		.replace(
			/\{bbox\}/g,
			`${bbox.west},${bbox.south},${bbox.east},${bbox.north}`
		)
		.replace(
			/\{selection\}/g,
			`${bbox.west};${bbox.south};${bbox.east};${bbox.north}`
		);
}

export function urlTemplateToUpdateTrigger(template) {
    if (Array.isArray(template)) {
        return template.join(';');
    }
    return template || '';
}