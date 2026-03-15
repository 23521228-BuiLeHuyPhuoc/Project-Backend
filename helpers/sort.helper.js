module.exports.sortObject = (obj) => {
	const sorted = {};
	const keys = Object.keys(obj || {}).sort();

	for (const key of keys) {
		const value = obj[key] == null ? "" : String(obj[key]);
		sorted[key] = encodeURIComponent(value).replace(/%20/g, "+");
	}

	return sorted;
}