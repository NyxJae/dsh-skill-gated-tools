import { scopeOf } from "@deepseek-ai/dsh-scope";
import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";
import { FileSystemSkillProvider } from "@deepseek-ai/dsh-skill-filesystem";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
//#region node_modules/.pnpm/@deepseek-ai+cosmokit@1.9.0/node_modules/@deepseek-ai/cosmokit/lib/index.js
/** Return true when a value is `null` or `undefined`. */
function isNullable(value) {
	return value === null || value === void 0;
}
/** Return true for non-array object values. */
function isPlainObject(data) {
	return data && typeof data === "object" && !Array.isArray(data);
}
/** Filter object entries and return a new object. */
function filterKeys(object, filter) {
	return Object.fromEntries(Object.entries(object).filter(([key, value]) => filter(key, value)));
}
/** Map object values while preserving the original key set. */
function mapValues(object, transform) {
	return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, transform(value, key)]));
}
/** Pick selected keys from an object, optionally including `undefined` values. */
function pick(source, keys, forced) {
	if (!keys) return { ...source };
	const result = {};
	for (const key of keys) if (forced || source[key] !== void 0) result[key] = source[key];
	return result;
}
/** Shared config references used by schema validators and plugin runtimes. */
const write = Symbol.for("cosmokit.volatile.write");
function snapshot(value, ancestors = /* @__PURE__ */ new Set()) {
	if (typeof value === "function") throw new TypeError("volatile config cannot contain functions");
	if (value === null || typeof value !== "object") return value;
	if (ancestors.has(value)) throw new TypeError("volatile config cannot contain cycles");
	ancestors.add(value);
	try {
		if (Array.isArray(value)) return Object.freeze(value.map((item) => snapshot(item, ancestors)));
		if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) throw new TypeError("volatile config objects must be plain objects or arrays");
		return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [key, snapshot(item, ancestors)])));
	} finally {
		ancestors.delete(value);
	}
}
/**
* Create a detached reference containing an immutable copy of the supplied data.
* @param value - validated config data; class instances and functions are unsupported.
* @returns a reference whose value is updated only by its owning runtime.
*/
function createVolatile(value) {
	let current = snapshot(value);
	return Object.freeze({
		get: () => current,
		[write]: (value) => {
			current = value;
		}
	});
}
/**
* Identify references across ESM/CJS copies of the shared library.
* @param value - a parsed config value.
* @returns whether the value implements the shared reference protocol.
*/
function isVolatile(value) {
	return typeof value === "object" && value !== null && write in value;
}
/** Test values using `instanceof` with a `toStringTag` fallback. */
function is(type, value) {
	if (arguments.length === 1) return (value) => is(type, value);
	return type in globalThis && value instanceof globalThis[type] || Object.prototype.toString.call(value).slice(8, -1) === type;
}
function isArrayBufferLike(value) {
	return is("ArrayBuffer", value) || is("SharedArrayBuffer", value);
}
function isArrayBufferSource(value) {
	return isArrayBufferLike(value) || ArrayBuffer.isView(value);
}
/** Binary source detection and base64/hex conversion helpers. */
var Binary;
(function(Binary) {
	Binary.is = isArrayBufferLike;
	Binary.isSource = isArrayBufferSource;
	function fromSource(source) {
		if (ArrayBuffer.isView(source)) return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
		else return source;
	}
	Binary.fromSource = fromSource;
	function toBase64(source) {
		source = fromSource(source);
		if (typeof Buffer !== "undefined") return Buffer.from(source).toString("base64");
		let binary = "";
		const bytes = new Uint8Array(source);
		for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
		return btoa(binary);
	}
	Binary.toBase64 = toBase64;
	function fromBase64(source) {
		if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "base64"));
		return Uint8Array.from(atob(source), (c) => c.charCodeAt(0));
	}
	Binary.fromBase64 = fromBase64;
	function toHex(source) {
		source = fromSource(source);
		if (typeof Buffer !== "undefined") return Buffer.from(source).toString("hex");
		return Array.from(new Uint8Array(source), (byte) => byte.toString(16).padStart(2, "0")).join("");
	}
	Binary.toHex = toHex;
	function fromHex(source) {
		if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "hex"));
		const hex = source.length % 2 === 0 ? source : source.slice(0, source.length - 1);
		const buffer = [];
		for (let i = 0; i < hex.length; i += 2) buffer.push(parseInt(`${hex[i]}${hex[i + 1]}`, 16));
		return Uint8Array.from(buffer).buffer;
	}
	Binary.fromHex = fromHex;
})(Binary || (Binary = {}));
Binary.fromBase64;
Binary.toBase64;
Binary.fromHex;
Binary.toHex;
/** Deep-clone common JavaScript values while preserving prototypes and cycles. */
function clone(source, refs = /* @__PURE__ */ new Map()) {
	if (!source || typeof source !== "object") return source;
	if (is("Date", source)) return new Date(source.valueOf());
	if (is("RegExp", source)) return new RegExp(source.source, source.flags);
	if (isArrayBufferLike(source)) return source.slice(0);
	if (ArrayBuffer.isView(source)) return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
	const cached = refs.get(source);
	if (cached) return cached;
	if (Array.isArray(source)) {
		const result = [];
		refs.set(source, result);
		source.forEach((value, index) => {
			result[index] = Reflect.apply(clone, null, [value, refs]);
		});
		return result;
	}
	const result = Object.create(Object.getPrototypeOf(source));
	refs.set(source, result);
	for (const key of Reflect.ownKeys(source)) {
		const descriptor = { ...Reflect.getOwnPropertyDescriptor(source, key) };
		if ("value" in descriptor) descriptor.value = Reflect.apply(clone, null, [descriptor.value, refs]);
		Reflect.defineProperty(result, key, descriptor);
	}
	return result;
}
/**
* Compare values recursively, treating two volatile references as equal regardless of value.
* Strict comparison distinguishes null/undefined, treats opaque objects by identity,
* compares URLs by normalized href, treats array holes as undefined, and considers distinct cyclic structures unequal.
* @param a - first value.
* @param b - second value.
* @param strict - whether to require strict data equality outside volatile references.
* @returns whether the values compare equal.
*/
function deepEqual(a, b, strict) {
	const ancestors = /* @__PURE__ */ new Set();
	function compare(a, b) {
		if (a === b) return true;
		if (isVolatile(a) || isVolatile(b)) return isVolatile(a) && isVolatile(b);
		if (!strict && isNullable(a) && isNullable(b)) return true;
		if (typeof a !== typeof b || typeof a !== "object" || !a || !b) return false;
		if (ancestors.has(a)) return false;
		function check(test, then) {
			return test(a) ? test(b) ? then(a, b) : false : test(b) ? false : void 0;
		}
		ancestors.add(a);
		try {
			return check(Array.isArray, (a, b) => {
				if (a.length !== b.length) return false;
				for (let index = 0; index < a.length; index++) if (!compare(a[index], b[index])) return false;
				return true;
			}) ?? check(is("Date"), (a, b) => a.valueOf() === b.valueOf()) ?? check(is("URL"), (a, b) => a.href === b.href) ?? check(is("RegExp"), (a, b) => a.source === b.source && a.flags === b.flags) ?? check(isArrayBufferLike, (a, b) => {
				if (a.byteLength !== b.byteLength) return false;
				const viewA = new Uint8Array(a);
				const viewB = new Uint8Array(b);
				for (let i = 0; i < viewA.length; i++) if (viewA[i] !== viewB[i]) return false;
				return true;
			}) ?? ((!strict || [a, b].every((value) => Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)) && Object.keys({
				...a,
				...b
			}).every((key) => compare(a[key], b[key])));
		} finally {
			ancestors.delete(a);
		}
	}
	return compare(a, b);
}
/** Time constants plus parsing and formatting helpers. */
var Time;
(function(Time) {
	Time.millisecond = 1;
	Time.second = 1e3;
	Time.minute = Time.second * 60;
	Time.hour = Time.minute * 60;
	Time.day = Time.hour * 24;
	Time.week = Time.day * 7;
	let timezoneOffset = (/* @__PURE__ */ new Date()).getTimezoneOffset();
	function setTimezoneOffset(offset) {
		timezoneOffset = offset;
	}
	Time.setTimezoneOffset = setTimezoneOffset;
	function getTimezoneOffset() {
		return timezoneOffset;
	}
	Time.getTimezoneOffset = getTimezoneOffset;
	function getDateNumber(date = /* @__PURE__ */ new Date(), offset) {
		if (typeof date === "number") date = new Date(date);
		if (offset === void 0) offset = timezoneOffset;
		return Math.floor((date.valueOf() / Time.minute - offset) / 1440);
	}
	Time.getDateNumber = getDateNumber;
	function fromDateNumber(value, offset) {
		const date = new Date(value * Time.day);
		if (offset === void 0) offset = timezoneOffset;
		return new Date(+date + offset * Time.minute);
	}
	Time.fromDateNumber = fromDateNumber;
	const numeric = /\d+(?:\.\d+)?/.source;
	const timeRegExp = new RegExp(`^${[
		"w(?:eek(?:s)?)?",
		"d(?:ay(?:s)?)?",
		"h(?:our(?:s)?)?",
		"m(?:in(?:ute)?(?:s)?)?",
		"s(?:ec(?:ond)?(?:s)?)?"
	].map((unit) => `(${numeric}${unit})?`).join("")}$`);
	function parseTime(source) {
		const capture = timeRegExp.exec(source);
		if (!capture) return 0;
		return (parseFloat(capture[1]) * Time.week || 0) + (parseFloat(capture[2]) * Time.day || 0) + (parseFloat(capture[3]) * Time.hour || 0) + (parseFloat(capture[4]) * Time.minute || 0) + (parseFloat(capture[5]) * Time.second || 0);
	}
	Time.parseTime = parseTime;
	function parseDate(date) {
		const parsed = parseTime(date);
		if (parsed) date = Date.now() + parsed;
		else if (/^\d{1,2}(:\d{1,2}){1,2}$/.test(date)) date = `${(/* @__PURE__ */ new Date()).toLocaleDateString()}-${date}`;
		else if (/^\d{1,2}-\d{1,2}-\d{1,2}(:\d{1,2}){1,2}$/.test(date)) date = `${(/* @__PURE__ */ new Date()).getFullYear()}-${date}`;
		return date ? new Date(date) : /* @__PURE__ */ new Date();
	}
	Time.parseDate = parseDate;
	function format(ms) {
		const abs = Math.abs(ms);
		if (abs >= Time.day - Time.hour / 2) return Math.round(ms / Time.day) + "d";
		else if (abs >= Time.hour - Time.minute / 2) return Math.round(ms / Time.hour) + "h";
		else if (abs >= Time.minute - Time.second / 2) return Math.round(ms / Time.minute) + "m";
		else if (abs >= Time.second) return Math.round(ms / Time.second) + "s";
		return ms + "ms";
	}
	Time.format = format;
	function toDigits(source, length = 2) {
		return source.toString().padStart(length, "0");
	}
	Time.toDigits = toDigits;
	function template(template, time = /* @__PURE__ */ new Date()) {
		return template.replace("yyyy", time.getFullYear().toString()).replace("yy", time.getFullYear().toString().slice(2)).replace("MM", toDigits(time.getMonth() + 1)).replace("dd", toDigits(time.getDate())).replace("hh", toDigits(time.getHours())).replace("mm", toDigits(time.getMinutes())).replace("ss", toDigits(time.getSeconds())).replace("SSS", toDigits(time.getMilliseconds(), 3));
	}
	Time.template = template;
})(Time || (Time = {}));
//#endregion
//#region node_modules/.pnpm/@deepseek-ai+schemastery@3.19.0/node_modules/@deepseek-ai/schemastery/lib/index.mjs
const kSchema = Symbol.for("schemastery");
const kValidationError = Symbol.for("ValidationError");
globalThis.__schemastery_index__ ??= 0;
globalThis.__schemastery_refs__ = void 0;
var ValidationError = class extends TypeError {
	options;
	name = "ValidationError";
	constructor(message, options) {
		let prefix = "$";
		for (const segment of options.path || []) if (typeof segment === "string") prefix += "." + segment;
		else if (typeof segment === "number") prefix += "[" + segment + "]";
		else if (typeof segment === "symbol") prefix += `[Symbol(${segment.toString()})]`;
		if (prefix.startsWith(".")) prefix = prefix.slice(1);
		super((prefix === "$" ? "" : `${prefix} `) + message);
		this.options = options;
	}
	static is(error) {
		return !!error?.[kValidationError];
	}
};
Object.defineProperty(ValidationError.prototype, kValidationError, { value: true });
const Schema = function(options) {
	const schema = function(data, options = {}) {
		return Schema.resolve(data, schema, options)[0];
	};
	if (options.refs) {
		const refs = mapValues(options.refs, (options) => new Schema(options));
		const getRef = (uid) => refs[uid];
		for (const key in refs) {
			const options = refs[key];
			options.sKey = getRef(options.sKey);
			options.inner = getRef(options.inner);
			options.list = options.list && options.list.map(getRef);
			options.dict = options.dict && mapValues(options.dict, getRef);
		}
		return refs[options.uid];
	}
	Object.assign(schema, options);
	if (typeof schema.callback === "string") try {
		schema.callback = new Function("return " + schema.callback)();
	} catch {}
	Object.defineProperty(schema, "uid", { value: globalThis.__schemastery_index__++ });
	Object.setPrototypeOf(schema, Schema.prototype);
	schema.meta ||= {};
	schema.toString = schema.toString.bind(schema);
	return schema;
};
Schema.prototype = Object.create(Function.prototype);
Schema.prototype[kSchema] = true;
Object.defineProperty(Schema.prototype, "~standard", { get() {
	return {
		version: 1,
		vendor: "schemastery",
		validate: (value) => {
			try {
				return { value: Schema.resolve(value, this, {})[0] };
			} catch (error) {
				if (ValidationError.is(error)) return { issues: [{
					message: error.message,
					path: error.options.path
				}] };
				throw error;
			}
		}
	};
} });
Schema.ValidationError = ValidationError;
Schema.prototype.toJSON = function toJSON() {
	if (globalThis.__schemastery_refs__) {
		globalThis.__schemastery_refs__[this.uid] ??= JSON.parse(JSON.stringify({ ...this }));
		return this.uid;
	}
	globalThis.__schemastery_refs__ = { [this.uid]: { ...this } };
	globalThis.__schemastery_refs__[this.uid] = JSON.parse(JSON.stringify({ ...this }));
	const result = {
		uid: this.uid,
		refs: globalThis.__schemastery_refs__
	};
	globalThis.__schemastery_refs__ = void 0;
	return result;
};
Schema.prototype.set = function set(key, value) {
	this.dict[key] = value;
	return this;
};
Schema.prototype.push = function push(value) {
	this.list.push(value);
	return this;
};
function mergeDesc(original, messages) {
	const result = typeof original === "string" ? { "": original } : { ...original };
	for (const locale in messages) {
		const value = messages[locale];
		if (value?.$description || value?.$desc) result[locale] = value.$description || value.$desc;
		else if (typeof value === "string") result[locale] = value;
	}
	return result;
}
function getInner(value) {
	return value?.$value ?? value?.$inner;
}
function extractKeys(data) {
	return filterKeys(data ?? {}, (key) => !key.startsWith("$"));
}
Schema.prototype.i18n = function i18n(messages) {
	const schema = Schema(this);
	const desc = mergeDesc(schema.meta.description, messages);
	if (Object.keys(desc).length) schema.meta.description = desc;
	if (schema.dict) schema.dict = mapValues(schema.dict, (inner, key) => {
		return inner.i18n(mapValues(messages, (data) => getInner(data)?.[key] ?? data?.[key]));
	});
	if (schema.list) schema.list = schema.list.map((inner, index) => {
		return inner.i18n(mapValues(messages, (data = {}) => {
			if (Array.isArray(getInner(data))) return getInner(data)[index];
			if (Array.isArray(data)) return data[index];
			return extractKeys(data);
		}));
	});
	if (schema.inner) schema.inner = schema.inner.i18n(mapValues(messages, (data) => {
		if (getInner(data)) return getInner(data);
		return extractKeys(data);
	}));
	if (schema.sKey) schema.sKey = schema.sKey.i18n(mapValues(messages, (data) => data?.$key));
	return schema;
};
Schema.prototype.extra = function extra(key, value) {
	const schema = Schema(this);
	schema.meta = {
		...schema.meta,
		[key]: value
	};
	return schema;
};
for (const key of [
	"required",
	"disabled",
	"collapse",
	"hidden",
	"loose"
]) Object.assign(Schema.prototype, { [key](value = true) {
	const schema = Schema(this);
	schema.meta = {
		...schema.meta,
		[key]: value
	};
	return schema;
} });
Schema.prototype.deprecated = function deprecated() {
	const schema = Schema(this);
	schema.meta.badges ||= [];
	schema.meta.badges.push({
		text: "deprecated",
		type: "danger"
	});
	return schema;
};
Schema.prototype.experimental = function experimental() {
	const schema = Schema(this);
	schema.meta.badges ||= [];
	schema.meta.badges.push({
		text: "experimental",
		type: "warning"
	});
	return schema;
};
Schema.prototype.pattern = function pattern(regexp) {
	const schema = Schema(this);
	const pattern = pick(regexp, ["source", "flags"]);
	schema.meta = {
		...schema.meta,
		pattern
	};
	return schema;
};
Schema.prototype.simplify = function simplify(value) {
	if (isVolatile(value)) value = value.get();
	if (deepEqual(value, this.meta.default, this.type === "dict")) return null;
	if (isNullable(value)) return value;
	if (this.type === "object" || this.type === "dict") {
		const result = {};
		for (const key in value) {
			const item = (this.type === "object" ? this.dict[key] : this.inner)?.simplify(value[key]);
			if (this.type === "dict" || !isNullable(item)) result[key] = item;
		}
		if (deepEqual(result, this.meta.default, this.type === "dict")) return null;
		return result;
	} else if (this.type === "array" || this.type === "tuple") {
		const result = [];
		value.forEach((value, index) => {
			const schema = this.type === "array" ? this.inner : this.list[index];
			const item = schema ? schema.simplify(value) : value;
			result.push(item);
		});
		return result;
	} else if (this.type === "intersect") {
		const result = {};
		for (const item of this.list) Object.assign(result, item.simplify(value));
		return result;
	} else if (this.type === "union") for (const schema of this.list) try {
		Schema.resolve(value, schema, {});
		return schema.simplify(value);
	} catch {}
	return value;
};
Schema.prototype.toString = function toString(inline) {
	return formatters[this.type]?.(this, inline) ?? `Schema<${this.type}>`;
};
Schema.prototype.role = function role(role, extra) {
	const schema = Schema(this);
	schema.meta = {
		...schema.meta,
		role,
		extra
	};
	return schema;
};
for (const key of [
	"default",
	"link",
	"comment",
	"description",
	"max",
	"min",
	"step"
]) Object.assign(Schema.prototype, { [key](value) {
	const schema = Schema(this);
	schema.meta = {
		...schema.meta,
		[key]: value
	};
	return schema;
} });
Schema.prototype.volatile = function volatile() {
	if (this.meta.volatile) throw new TypeError("volatile schema is already wrapped");
	return this.extra("volatile", true);
};
const resolvers = {};
const checkedVolatile = Symbol("checked-volatile-schema");
function validateVolatileSchema(schema, path = [], blocked = false, seen = /* @__PURE__ */ new Map()) {
	const states = seen.get(schema) ?? /* @__PURE__ */ new Set();
	if (states.has(blocked)) return;
	states.add(blocked);
	seen.set(schema, states);
	if (schema.meta?.volatile && blocked) throw new ValidationError("volatile fields require a fixed object path without an enclosing volatile field", { path });
	const nested = blocked || !!schema.meta?.volatile;
	if (schema.dict) for (const [key, child] of Object.entries(schema.dict)) validateVolatileSchema(child, [...path, key], nested, seen);
	if (schema.sKey) validateVolatileSchema(schema.sKey, [...path, "<key>"], true, seen);
	if (schema.inner && (schema.type !== "lazy" || schema.inner[kSchema])) validateVolatileSchema(schema.inner, [...path, "*"], true, seen);
	if (schema.list) for (let index = 0; index < schema.list.length; index++) validateVolatileSchema(schema.list[index], [...path, String(index)], true, seen);
}
Schema.extend = function extend(type, resolve) {
	resolvers[type] = resolve;
};
Schema.resolve = function resolve(data, schema, options = {}, strict = false) {
	if (!schema) return [data];
	if (!options[checkedVolatile]) {
		validateVolatileSchema(schema, options.path);
		options = {
			...options,
			[checkedVolatile]: true
		};
	}
	if (schema.meta?.volatile) {
		const inner = Schema(schema);
		inner.meta = {
			...schema.meta,
			volatile: false
		};
		const [value, adapted] = Schema.resolve(data, inner, options, strict);
		try {
			return [createVolatile(value), adapted];
		} catch (error) {
			throw new ValidationError(error instanceof Error ? error.message : String(error), options);
		}
	}
	if (options.ignore?.(data, schema)) return [data];
	if (isNullable(data) && schema.type !== "lazy") {
		if (schema.meta.required) throw new ValidationError(`missing required value`, options);
		let current = schema;
		let fallback = schema.meta.default;
		while (current?.type === "intersect" && isNullable(fallback)) {
			current = current.list[0];
			fallback = current?.meta.default;
		}
		if (isNullable(fallback)) return [data];
		data = clone(fallback);
	}
	const callback = resolvers[schema.type];
	if (!callback) throw new ValidationError(`unsupported type "${schema.type}"`, options);
	try {
		return callback(data, schema, options, strict);
	} catch (error) {
		if (!schema.meta.loose) throw error;
		return [schema.meta.default];
	}
};
Schema.from = function from(source) {
	if (isNullable(source)) return Schema.any();
	else if ([
		"string",
		"number",
		"boolean"
	].includes(typeof source)) return Schema.const(source).required();
	else if (source[kSchema]) return source;
	else if (typeof source === "function") switch (source) {
		case String: return Schema.string().required();
		case Number: return Schema.number().required();
		case Boolean: return Schema.boolean().required();
		case Function: return Schema.function().required();
		default: return Schema.is(source).required();
	}
	else throw new TypeError(`cannot infer schema from ${source}`);
};
Schema.lazy = function lazy(builder) {
	const toJSON = () => {
		if (!schema.inner[kSchema]) {
			schema.inner = schema.builder();
			schema.inner.meta = {
				...schema.meta,
				...schema.inner.meta
			};
		}
		return schema.inner.toJSON();
	};
	const schema = new Schema({
		type: "lazy",
		builder,
		inner: { toJSON }
	});
	return schema;
};
Schema.natural = function natural() {
	return Schema.number().step(1).min(0);
};
Schema.percent = function percent() {
	return Schema.number().step(.01).min(0).max(1).role("slider");
};
Schema.date = function date() {
	return Schema.union([Schema.is(Date), Schema.transform(Schema.string().role("datetime"), (value, options) => {
		const date = new Date(value);
		if (isNaN(+date)) throw new ValidationError(`invalid date "${value}"`, options);
		return date;
	}, true)]);
};
Schema.regExp = function regExp(flag = "") {
	return Schema.union([Schema.is(RegExp), Schema.transform(Schema.string().role("regexp", { flag }), (value, options) => {
		try {
			return new RegExp(value, flag);
		} catch (e) {
			throw new ValidationError(e.message, options);
		}
	}, true)]);
};
Schema.arrayBuffer = function arrayBuffer(encoding) {
	return Schema.union([
		Schema.is(ArrayBuffer),
		Schema.is(SharedArrayBuffer),
		Schema.transform(Schema.any(), (value, options) => {
			if (Binary.isSource(value)) return Binary.fromSource(value);
			throw new ValidationError(`expected ArrayBufferSource but got ${value}`, options);
		}, true),
		...encoding ? [Schema.transform(Schema.string(), (value, options) => {
			try {
				return encoding === "base64" ? Binary.fromBase64(value) : Binary.fromHex(value);
			} catch (e) {
				throw new ValidationError(e.message, options);
			}
		}, true)] : []
	]);
};
Schema.extend("lazy", (data, schema, options, strict) => {
	if (!schema.inner[kSchema]) {
		schema.inner = schema.builder();
		schema.inner.meta = {
			...schema.meta,
			...schema.inner.meta
		};
		validateVolatileSchema(schema.inner, options.path, true);
	}
	return Schema.resolve(data, schema.inner, options, strict);
});
Schema.extend("any", (data) => {
	return [data];
});
Schema.extend("never", (data, _, options) => {
	throw new ValidationError(`expected nullable but got ${data}`, options);
});
Schema.extend("const", (data, { value }, options) => {
	if (deepEqual(data, value)) return [value];
	throw new ValidationError(`expected ${value} but got ${data}`, options);
});
function checkWithinRange(data, meta, description, options, skipMin = false) {
	const { max = Infinity, min = -Infinity } = meta;
	if (data > max) throw new ValidationError(`expected ${description} <= ${max} but got ${data}`, options);
	if (data < min && !skipMin) throw new ValidationError(`expected ${description} >= ${min} but got ${data}`, options);
}
Schema.extend("string", (data, { meta }, options) => {
	if (typeof data !== "string") throw new ValidationError(`expected string but got ${data}`, options);
	if (meta.pattern) {
		const regexp = new RegExp(meta.pattern.source, meta.pattern.flags);
		if (!regexp.test(data)) throw new ValidationError(`expect string to match regexp ${regexp}`, options);
	}
	checkWithinRange(data.length, meta, "string length", options);
	return [data];
});
function decimalShift(data, digits) {
	const str = data.toString();
	if (str.includes("e")) return data * Math.pow(10, digits);
	const index = str.indexOf(".");
	if (index === -1) return data * Math.pow(10, digits);
	const frac = str.slice(index + 1);
	const integer = str.slice(0, index);
	if (frac.length <= digits) return +(integer + frac.padEnd(digits, "0"));
	return +(integer + frac.slice(0, digits) + "." + frac.slice(digits));
}
function isMultipleOf(data, min, step) {
	step = Math.abs(step);
	if (!/^\d+\.\d+$/.test(step.toString())) return (data - min) % step === 0;
	const index = step.toString().indexOf(".");
	const digits = step.toString().slice(index + 1).length;
	return Math.abs(decimalShift(data, digits) - decimalShift(min, digits)) % decimalShift(step, digits) === 0;
}
Schema.extend("number", (data, { meta }, options) => {
	if (typeof data !== "number") throw new ValidationError(`expected number but got ${data}`, options);
	checkWithinRange(data, meta, "number", options);
	const { step } = meta;
	if (step && !isMultipleOf(data, meta.min ?? 0, step)) throw new ValidationError(`expected number multiple of ${step} but got ${data}`, options);
	return [data];
});
Schema.extend("boolean", (data, _, options) => {
	if (typeof data === "boolean") return [data];
	throw new ValidationError(`expected boolean but got ${data}`, options);
});
Schema.extend("bitset", (data, { bits, meta }, options) => {
	let value = 0, keys = [];
	if (typeof data === "number") {
		value = data;
		for (const key in bits) if (data & bits[key]) keys.push(key);
	} else if (Array.isArray(data)) {
		keys = data;
		for (const key of keys) {
			if (typeof key !== "string") throw new ValidationError(`expected string but got ${key}`, options);
			if (key in bits) value |= bits[key];
		}
	} else throw new ValidationError(`expected number or array but got ${data}`, options);
	if (value === meta.default) return [value];
	return [value, keys];
});
Schema.extend("function", (data, _, options) => {
	if (typeof data === "function") return [data];
	throw new ValidationError(`expected function but got ${data}`, options);
});
Schema.extend("is", (data, { constructor }, options) => {
	if (typeof constructor === "function") {
		if (data instanceof constructor) return [data];
		throw new ValidationError(`expected ${constructor.name} but got ${data}`, options);
	} else {
		if (isNullable(data)) throw new ValidationError(`expected ${constructor} but got ${data}`, options);
		let prototype = Object.getPrototypeOf(data);
		while (prototype) {
			if (prototype.constructor?.name === constructor) return [data];
			prototype = Object.getPrototypeOf(prototype);
		}
		throw new ValidationError(`expected ${constructor} but got ${data}`, options);
	}
});
function property(data, key, schema, options) {
	try {
		const [value, adapted] = Schema.resolve(data[key], schema, {
			...options,
			path: [...options.path || [], key]
		});
		if (adapted !== void 0) data[key] = adapted;
		return value;
	} catch (e) {
		if (!options?.autofix) throw e;
		delete data[key];
		return schema.meta.volatile ? createVolatile(schema.meta.default) : schema.meta.default;
	}
}
Schema.extend("array", (data, { inner, meta }, options) => {
	if (!Array.isArray(data)) throw new ValidationError(`expected array but got ${data}`, options);
	checkWithinRange(data.length, meta, "array length", options, !isNullable(inner.meta.default));
	return [data.map((_, index) => property(data, index, inner, options))];
});
Schema.extend("dict", (data, { inner, sKey }, options, strict) => {
	if (!isPlainObject(data)) throw new ValidationError(`expected object but got ${data}`, options);
	const result = {};
	for (const key in data) {
		let rKey;
		try {
			rKey = Schema.resolve(key, sKey, options)[0];
		} catch (error) {
			if (strict) continue;
			throw error;
		}
		result[rKey] = property(data, key, inner, options);
		data[rKey] = data[key];
		if (key !== rKey) delete data[key];
	}
	return [result];
});
Schema.extend("tuple", (data, { list }, options, strict) => {
	if (!Array.isArray(data)) throw new ValidationError(`expected array but got ${data}`, options);
	const result = list.map((inner, index) => property(data, index, inner, options));
	if (strict) return [result];
	result.push(...data.slice(list.length));
	return [result];
});
function merge(result, data) {
	for (const key in data) {
		if (key in result) continue;
		result[key] = data[key];
	}
}
Schema.extend("object", (data, { dict }, options, strict) => {
	if (!isPlainObject(data)) throw new ValidationError(`expected object but got ${data}`, options);
	const result = {};
	for (const key in dict) {
		const value = property(data, key, dict[key], options);
		if (!isNullable(value) || key in data) result[key] = value;
	}
	if (!strict) merge(result, data);
	return [result];
});
Schema.extend("union", (data, { list, toString }, options, strict) => {
	const messages = [];
	for (const inner of list) try {
		return Schema.resolve(data, inner, options, strict);
	} catch (error) {
		messages.push(error);
	}
	throw new ValidationError(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
});
Schema.extend("intersect", (data, { list, toString }, options, strict) => {
	if (!list.length) return [data];
	let result;
	for (const inner of list) {
		const value = Schema.resolve(data, inner, options, true)[0];
		if (isNullable(value)) continue;
		if (isNullable(result)) result = value;
		else if (typeof result !== typeof value) throw new ValidationError(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
		else if (typeof value === "object") merge(result ??= {}, value);
		else if (result !== value) throw new ValidationError(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
	}
	if (!strict && isPlainObject(data)) merge(result, data);
	return [result];
});
Schema.extend("transform", (data, { inner, callback, preserve }, options) => {
	const [result, adapted = data] = Schema.resolve(data, inner, options, true);
	if (preserve) return [callback(result)];
	else return [callback(result), callback(adapted)];
});
const formatters = {};
function defineMethod(name, keys, format) {
	formatters[name] = format;
	Object.assign(Schema, { [name](...args) {
		const schema = new Schema({ type: name });
		keys.forEach((key, index) => {
			switch (key) {
				case "sKey":
					schema.sKey = args[index] ?? Schema.string();
					break;
				case "inner":
					schema.inner = Schema.from(args[index]);
					break;
				case "list":
					schema.list = args[index].map(Schema.from);
					break;
				case "dict":
					schema.dict = mapValues(args[index], Schema.from);
					break;
				case "bits":
					schema.bits = {};
					for (const key in args[index]) {
						if (typeof args[index][key] !== "number") continue;
						schema.bits[key] = args[index][key];
					}
					break;
				case "callback": {
					const callback = schema.callback = args[index];
					callback["toJSON"] ||= () => callback.toString();
					break;
				}
				case "constructor": {
					const constructor = schema.constructor = args[index];
					if (typeof constructor === "function") constructor["toJSON"] ||= () => constructor["name"];
					break;
				}
				default: schema[key] = args[index];
			}
		});
		if (name === "object" || name === "dict") schema.meta.default = {};
		else if (name === "array" || name === "tuple") schema.meta.default = [];
		else if (name === "bitset") schema.meta.default = 0;
		return schema;
	} });
}
defineMethod("is", ["constructor"], ({ constructor }) => {
	if (typeof constructor === "function") return constructor.name;
	else return constructor;
});
defineMethod("any", [], () => "any");
defineMethod("never", [], () => "never");
defineMethod("const", ["value"], ({ value }) => typeof value === "string" ? JSON.stringify(value) : value);
defineMethod("string", [], () => "string");
defineMethod("number", [], () => "number");
defineMethod("boolean", [], () => "boolean");
defineMethod("bitset", ["bits"], () => "bitset");
defineMethod("function", [], () => "function");
defineMethod("array", ["inner"], ({ inner }) => `${inner.toString(true)}[]`);
defineMethod("dict", ["inner", "sKey"], ({ inner, sKey }) => `{ [key: ${sKey.toString()}]: ${inner.toString()} }`);
defineMethod("tuple", ["list"], ({ list }) => `[${list.map((inner) => inner.toString()).join(", ")}]`);
defineMethod("object", ["dict"], ({ dict }) => {
	if (Object.keys(dict).length === 0) return "{}";
	return `{ ${Object.entries(dict).map(([key, inner]) => {
		return `${key}${inner.meta.required ? "" : "?"}: ${inner.toString()}`;
	}).join(", ")} }`;
});
defineMethod("union", ["list"], ({ list }, inline) => {
	const result = list.map(({ toString: format }) => format()).join(" | ");
	return inline ? `(${result})` : result;
});
defineMethod("intersect", ["list"], ({ list }) => {
	return `${list.map((inner) => inner.toString(true)).join(" & ")}`;
});
defineMethod("transform", [
	"inner",
	"callback",
	"preserve"
], ({ inner }, isInner) => inner.toString(isInner));
//#endregion
//#region lib/types/api.js
/**
* Settings REST surface for the gate.
*
* The page needs three facts it cannot get from the browser: the skill catalog,
* the registered tool names, and the stored bindings. It also needs a write
* path. All four live behind this one prefix route, guarded by the connection
* service's request fence so only the trusted browser reaches it.
*
* @module dsh-skill-gated-tools/api
*/
/** Prefix every route in this plugin hangs under. */
const ROUTE_PREFIX = "/skill-gate";
/** A body larger than this is not a binding document. */
const MAX_BODY_BYTES = 64 * 1024;
/** Write a JSON response that browsers must not cache. */
function sendJson(res, status, payload) {
	res.statusCode = status;
	res.setHeader("content-type", "application/json; charset=utf-8");
	res.setHeader("cache-control", "no-store");
	res.end(JSON.stringify(payload));
}
/** Answer 405 with the route's supported methods. */
function sendMethodNotAllowed(res, allow) {
	res.statusCode = 405;
	res.setHeader("allow", allow);
	res.end();
}
/** Resolve a prefix route's request URL against a throwaway origin. */
function requestUrl(req) {
	return new URL(String(req.url ?? "/"), "http://localhost");
}
/** Read a JSON request body, bounded by {@link MAX_BODY_BYTES}. */
async function readJsonBody(req) {
	const chunks = [];
	let size = 0;
	for await (const chunk of req) {
		const buffer = chunk;
		size += buffer.length;
		if (size > MAX_BODY_BYTES) throw new Error(`request body exceeds ${String(MAX_BODY_BYTES)} bytes`);
		chunks.push(buffer);
	}
	if (size === 0) return void 0;
	return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
/**
* Mount the settings REST surface.
* @param ctx - the injected scope owning the route registration effect.
* @param store - the binding store the page reads and writes.
* @param webServer - the route carrier serving every route below.
* @param toolNames - every tool name the page may offer.
* @param skillNames - every skill name the page may offer, absent in compositions without skills.
* @param fence - reads the connection service's request fence at request time.
* @param startupNames - cold default-preset tools, without live-Agent contributions.
* @param locations - effective and legacy document locations; absent outside a profile.
*/
function mountApi(ctx, store, webServer, toolNames, skillNames, fence, startupNames, locations) {
	/** Refuse a request the connection fence does not trust. */
	const rejected = (req, res) => {
		const connection = fence();
		if (connection === void 0) {
			sendJson(res, 503, {
				code: "trust-fence-unavailable",
				message: "the connection service is not available"
			});
			return true;
		}
		const rejection = connection.requestRejection(req);
		if (rejection === void 0) return false;
		res.statusCode = rejection;
		res.end();
		return true;
	};
	/** Collect the current page state. */
	const snapshot = async () => {
		const warnings = [];
		let names = [];
		let skillsResolved = false;
		try {
			if (skillNames === void 0) throw new Error("no skill catalog in this composition");
			names = [...await skillNames()].sort();
			skillsResolved = true;
		} catch (error) {
			warnings.push(`skill catalog unavailable: ${String(error)}`);
		}
		let startupTools = null;
		try {
			if (startupNames === void 0) throw new Error("default preset view is unavailable");
			startupTools = [...await startupNames()].sort();
		} catch (error) {
			warnings.push("startup preview unavailable: " + String(error));
		}
		const toolList = [...await toolNames()].sort();
		const bindings = await store.rows();
		const blockedTools = [...(await store.load()).blockedTools].sort();
		const legacy = locations?.legacy;
		const legacyAvailable = legacy !== void 0 && !await store.exists() && await legacy.exists();
		return {
			skills: names,
			skillsResolved,
			tools: toolList,
			startupTools,
			bindings,
			blockedTools,
			warnings,
			bindingPath: store.file,
			profileName: locations?.profileName ?? null,
			legacyBindingPath: locations?.legacyPath ?? store.file,
			legacyAvailable
		};
	};
	ctx.effect(() => webServer.register({
		kind: "prefix",
		path: ROUTE_PREFIX,
		handler: async (req, res) => {
			if (rejected(req, res)) return;
			const url = requestUrl(req);
			try {
				if (url.pathname === "/skill-gate" && req.method === "GET") {
					sendJson(res, 200, {
						ok: true,
						...await snapshot()
					});
					return;
				}
				if (url.pathname === `/skill-gate/bindings/import-legacy`) {
					if (req.method !== "POST") {
						sendMethodNotAllowed(res, "POST");
						return;
					}
					const legacy = locations?.legacy;
					if (legacy === void 0) {
						sendJson(res, 409, {
							ok: false,
							message: "this installation has no legacy binding document to import"
						});
						return;
					}
					if (await store.exists()) {
						sendJson(res, 409, {
							ok: false,
							message: `${store.file} already exists; import never overwrites it`
						});
						return;
					}
					if (!await legacy.exists()) {
						sendJson(res, 404, {
							ok: false,
							message: `no legacy document at ${legacy.file}`
						});
						return;
					}
					const document = await legacy.load();
					if (document.gated.size === 0) {
						sendJson(res, 409, {
							ok: false,
							message: `${legacy.file} holds no rules to import`
						});
						return;
					}
					sendJson(res, 200, {
						ok: true,
						bindings: await store.save(await legacy.rows(), [...document.blockedTools]),
						blockedTools: [...(await store.load()).blockedTools].sort()
					});
					return;
				}
				if (url.pathname === `/skill-gate/bindings`) {
					if (req.method === "GET") {
						sendJson(res, 200, {
							ok: true,
							bindings: await store.rows(),
							blockedTools: [...(await store.load()).blockedTools].sort()
						});
						return;
					}
					if (req.method === "PUT") {
						const body = await readJsonBody(req);
						const rows = body?.bindings;
						if (!Array.isArray(rows)) {
							sendJson(res, 400, {
								ok: false,
								message: "body must be { bindings: [...] }"
							});
							return;
						}
						sendJson(res, 200, {
							ok: true,
							bindings: await store.save(rows, body?.blockedTools),
							blockedTools: [...(await store.load()).blockedTools].sort()
						});
						return;
					}
					sendMethodNotAllowed(res, "GET, PUT");
					return;
				}
				sendJson(res, 404, {
					ok: false,
					message: `no route for ${url.pathname}`
				});
			} catch (error) {
				sendJson(res, 400, {
					ok: false,
					message: String(error)
				});
			}
		}
	}), `skill-gate: ${ROUTE_PREFIX}`);
}
//#endregion
//#region node_modules/.pnpm/@deepseek-ai+dsh-home-paths_2ea830fc8b6f928d66a0ec4e4caf45af/node_modules/@deepseek-ai/dsh-home-paths/lib/index.js
/**
* Shared filesystem path helpers for DeepSeek Harness user data.
*
* @module @deepseek-ai/dsh-home-paths
*/
/** Directory name for the default DeepSeek Harness home under the OS home. */
const DSH_HOME_DIR_NAME = ".dsh";
/** Environment variable that overrides the default DeepSeek Harness home. */
const DSH_HOME_ENV = "DSH_HOME";
/**
* Resolve the default DeepSeek Harness home using Node's platform path rules.
* @returns the absolute default harness home path.
*/
function defaultDshHome() {
	return join(homedir(), DSH_HOME_DIR_NAME);
}
/**
* Expand supported tilde prefixes against the operating-system home.
* @param path - configured path that may begin with `~`, `~/`, or `~\`.
* @returns the expanded path, or the original value when no supported prefix is present.
*/
function expandHomePath(path) {
	if (path === "~") return homedir();
	if (path.startsWith("~/") || path.startsWith("~\\")) return join(homedir(), path.slice(2));
	return path;
}
/**
* Resolve one user-data root from an explicit path, an environment override, and a default.
* @param configured - explicit path, which has highest precedence.
* @param env - environment mapping to read.
* @param envName - environment variable that overrides the default.
* @param fallback - default root, used when neither the explicit path nor the environment provides one.
* @returns the normalized absolute root.
*/
function resolveRoot(configured, env, envName, fallback) {
	const fromEnv = env[envName];
	return resolve(expandHomePath(configured ?? (fromEnv !== void 0 && fromEnv.trim().length > 0 ? fromEnv : fallback())));
}
/**
* Resolve the single-root DeepSeek Harness home.
*
* Precedence, highest first: an explicit configured path, `$DSH_HOME`, then
* `~/.dsh`. The harness keeps all user data under one root. An empty or
* whitespace-only `$DSH_HOME` is treated as unset, so a blank override never
* resolves the home to the current working directory.
* @param configured - explicit harness-home override, which has highest precedence.
* @param env - environment mapping used to read `DSH_HOME`.
* @returns the normalized absolute harness home path.
*/
function resolveDshHome(configured, env = process.env) {
	return resolveRoot(configured, env, DSH_HOME_ENV, defaultDshHome);
}
/**
* Join path segments onto the resolved DeepSeek Harness home.
* @param segments - path segments appended to the Harness home; an empty list returns the home itself.
* @returns the normalized absolute joined path.
*/
function dshHomePath(...segments) {
	return join(resolveDshHome(), ...segments);
}
//#endregion
//#region lib/types/bindings.js
/**
* Binding document for skill-gated tools.
*
* The file is the plugin's only persistent state. It is read at Agent creation
* and again whenever a new skill loads, so an edit affects the next load
* without a process restart. The document is small, so it is read every time
* rather than cached: a cache keyed on mtime and size would silently serve a
* stale table after a same-size edit.
*
* @module dsh-skill-gated-tools/bindings
*/
/**
* The legacy global binding file.
*
* It stays the fallback for a process that runs outside any profile, and the
* import source for profile-owned files: nothing reads it as live rules once a
* profile owns its own table.
* @returns the absolute path under the Harness home.
*/
function defaultBindingPath() {
	return dshHomePath("skill-gate", "bindings.json");
}
/**
* The binding file one profile owns.
*
* Two hosts sharing a Harness home still run different profiles, and their
* rule tables must not overwrite each other; the profile directory is the one
* identity the launcher hands to every plugin.
* @param profileDir - absolute profile directory supplied by the launcher.
* @returns the profile-owned binding path.
*/
function profileBindingPath(profileDir) {
	return join(profileDir, "skill-gate", "bindings.json");
}
const EMPTY = {
	bySkill: /* @__PURE__ */ new Map(),
	gated: /* @__PURE__ */ new Set(),
	blockedTools: /* @__PURE__ */ new Set()
};
/**
* Read a binding document out of parsed JSON.
*
* Two spellings are accepted for the same content: the stored document with
* `version`, and the plain `{ bindings }` body the settings page sends. Rows
* for the same skill merge, so an entry added twice unions its tools.
* @param value - parsed JSON.
* @param path - file the value came from, for diagnostics.
* @returns the indexed document.
* @throws {Error} when the value is not a valid document.
*/
function parseBindings(value, path) {
	if (typeof value !== "object" || value === null) throw new Error(`skill-gate: ${path} must contain a JSON object`);
	const root = value;
	if (root.version !== void 0 && root.version !== 1) throw new Error(`skill-gate: ${path} declares unsupported version ${String(root.version)}; expected 1`);
	const blocked = root.blockedTools === void 0 ? [] : root.blockedTools;
	if (!Array.isArray(blocked) || blocked.some((tool) => typeof tool !== "string" || tool.trim() === "")) throw new Error(`skill-gate: ${path} "blockedTools" must be an array of non-empty strings`);
	const blockedTools = new Set(blocked);
	const rows = root.bindings ?? [];
	if (!Array.isArray(rows)) throw new Error(`skill-gate: ${path} "bindings" must be an array`);
	const bySkill = /* @__PURE__ */ new Map();
	const gated = new Set(blockedTools);
	for (const [index, row] of rows.entries()) {
		if (typeof row !== "object" || row === null) throw new Error(`skill-gate: ${path} bindings[${index}] must be an object`);
		const entry = row;
		const skill = entry.skill;
		if (typeof skill !== "string" || skill === "") throw new Error(`skill-gate: ${path} bindings[${index}].skill must be a non-empty string`);
		const tools = entry.tools;
		if (!Array.isArray(tools) || tools.some((tool) => typeof tool !== "string" || tool === "")) throw new Error(`skill-gate: ${path} bindings[${index}].tools must be an array of non-empty strings`);
		const names = tools;
		bySkill.set(skill, [...bySkill.get(skill) ?? [], ...names]);
		for (const name of names) gated.add(name);
	}
	return {
		bySkill,
		gated,
		blockedTools
	};
}
/**
* Reads and writes the binding document.
*
* A missing file is a valid empty document, so a fresh install gates nothing.
* A malformed file throws rather than silently gating nothing: a typo in a
* visibility table must not look like success.
*/
var BindingStore = class {
	path;
	constructor(path) {
		this.path = path;
	}
	/** The file this store reads. */
	get file() {
		return this.path;
	}
	/** Whether the document currently exists on disk. */
	async exists() {
		try {
			await access(this.path);
			return true;
		} catch {
			return false;
		}
	}
	/**
	* Read and parse the current document.
	* @returns the parsed document; empty when the file does not exist.
	*/
	async load() {
		let raw;
		try {
			raw = await readFile(this.path, "utf8");
		} catch (error) {
			if (error.code === "ENOENT") return EMPTY;
			throw error;
		}
		let parsed;
		try {
			parsed = JSON.parse(raw);
		} catch (cause) {
			throw new Error(`skill-gate: ${this.path} is not valid JSON`, { cause });
		}
		return parseBindings(parsed, this.path);
	}
	/**
	* The current rows, in document order with duplicate skills merged.
	* @returns one row per bound skill.
	*/
	async rows() {
		const { bySkill } = await this.load();
		return [...bySkill].map(([skill, tools]) => ({
			skill,
			tools: [...new Set(tools)].sort()
		}));
	}
	/**
	* Replace the document.
	*
	* The write goes to a sibling temporary file and is renamed into place, so a
	* reader never observes a half-written document. Rows are validated with the
	* same parser `load` uses, so a page that sends a malformed body is rejected
	* instead of persisted.
	* @param rows - the bindings to store.
	* @param blockedTools - always-hidden tools; omitted preserves the stored list.
	* @returns the rows as stored, with duplicate skills merged.
	* @throws {Error} when the rows are not a valid document.
	*/
	async save(rows, blockedTools) {
		const document = {
			version: 1,
			bindings: rows,
			blockedTools: blockedTools === void 0 ? [...(await this.load()).blockedTools] : blockedTools
		};
		parseBindings(document, this.path);
		await mkdir(dirname(this.path), { recursive: true });
		const temporary = join(dirname(this.path), `.${Date.now()}.bindings.json`);
		await writeFile(temporary, `${JSON.stringify(document, null, 2)}\n`, "utf8");
		await rename(temporary, this.path);
		return this.rows();
	}
};
//#endregion
//#region lib/types/claude-skills.js
/**
* Claude skill root: one more official filesystem provider, ranked last.
*
* The desktop composition mounts `@deepseek-ai/dsh-skill-filesystem` inside the
* Agent presets, and that provider scans the DSH and Agents roots only, so
* `~/.claude/skills` stays invisible to `ctx.skills` unless somebody
* contributes a provider for it. This module contributes one instance of that
* same official provider, restricted to the Claude root: discovery, frontmatter
* parsing, body loading, and watching stay in the shipped implementation.
*
* Claude candidates are republished at {@link CLAUDE_SKILL_RANK}, below every
* built-in root (project 100/200, custom 300, DSH 400, Agents 500, bundled 600),
* so a Claude skill cannot displace a same-named skill from the roots a
* deployment already had. Layers still decide first: a preset- or Agent-scoped
* skill keeps overriding this global contribution exactly as before.
*
* @module dsh-skill-gated-tools/claude-skills
*/
/** Provider name, distinct from the preset's `filesystem` provider so both can share the global layer. */
const CLAUDE_PROVIDER_NAME = "claude-skills";
/**
* The root scanned for Claude skills.
* @param env - environment carrying the optional `CLAUDE_CONFIG_DIR` override; a blank value falls back to the home directory.
* @returns absolute path of the Claude skills directory.
*/
function claudeSkillsDir(env = process.env) {
	const configured = env.CLAUDE_CONFIG_DIR?.trim() ?? "";
	return join(configured === "" ? join(homedir(), ".claude") : configured, "skills");
}
/**
* Whether a provider answered with the incomplete-observation shape.
*
* `Array.isArray` cannot narrow a `readonly T[]` union member away, so this
* guard is what lets the wrapper rewrite both shapes without a cast.
* @param answer - the value a provider's `list` returned.
* @returns true for the observation shape.
*/
function isObservation(answer) {
	return !Array.isArray(answer);
}
/**
* Provider wrapper that delegates every operation but one fixed candidate rank.
*
* The official provider publishes the rank of the root it read, which is the
* root order that suits a provider owning several roots. A contribution that
* owns exactly one root instead publishes that root's place in the global
* order, which the inner provider cannot know.
*/
var RankedSkillProvider = class {
	inner;
	rank;
	/**
	* @param inner - provider whose discovery and loading are reused unchanged.
	* @param rank - candidate rank to publish, replacing the inner provider's own.
	*/
	constructor(inner, rank) {
		this.inner = inner;
		this.rank = rank;
	}
	/** Provider name, forwarded so one source keeps one identity in the registry. */
	get name() {
		return this.inner.name;
	}
	/**
	* @param options - lookup options forwarded untouched.
	* @returns the inner candidates with this provider's rank.
	*/
	async list(options) {
		const observation = await this.inner.list(options);
		if (!isObservation(observation)) return observation.map((candidate) => ({
			...candidate,
			rank: this.rank
		}));
		return {
			...observation,
			candidates: observation.candidates.map((candidate) => ({
				...candidate,
				rank: this.rank
			}))
		};
	}
	/**
	* @param candidate - the winning candidate this provider had listed.
	* @param options - lookup options forwarded untouched.
	* @returns the inner skill body.
	*/
	async get(candidate, options) {
		return await this.inner.get(candidate, options);
	}
};
/**
* Attach the Claude root to a context whose `skills` service is live.
*
* The provider is registered without a scope, so it lands in the global layer
* and every Agent view inherits it; a missing directory lists as empty until the
* user creates it. Disposal follows the registration through Cordis, so no
* explicit teardown is needed here.
* @param ctx - context carrying a live `skills` registry.
*/
function mountClaudeSkills(ctx) {
	ctx.skills.registerProvider((control) => new RankedSkillProvider(new FileSystemSkillProvider(ctx, control, {
		providerName: CLAUDE_PROVIDER_NAME,
		includeDefaultRoots: false,
		customSkillDirs: [claudeSkillsDir()]
	}), 700));
}
//#endregion
//#region lib/types/gate.js
/**
* Skill-gated tool visibility.
*
* A tool listed in the binding document is hidden from every Agent until that
* Agent loads a skill bound to it; blocked tools stay hidden. Tools absent from the document are never
* touched, so the plugin is inert until the user opts a tool in.
*
* Visibility is masked per Agent with `ctx.tools.restrict({ deny })`, which
* removes the tool from that Agent's schema set, lookups, and dispatch while
* leaving every plugin's registration untouched.
*
* @module dsh-skill-gated-tools/gate
*/
/**
* Parse a `skill` tool argument payload, which arrives normalized (object) or
* as the raw JSON string the model produced.
* @param args - the normalized or raw argument value.
* @returns the requested skill name, when the payload carries one.
*/
function skillNameOf(args) {
	if (typeof args === "string") try {
		return skillNameOf(JSON.parse(args));
	} catch {
		return;
	}
	if (typeof args !== "object" || args === null) return void 0;
	const name = args.name;
	return typeof name === "string" ? name : void 0;
}
/**
* Decide which skills a durable session log proves were loaded.
*
* Two shapes count: a `skill-invocation` user message (the `/name` gesture
* path) and a `skill` tool call paired with a non-error result. The pairing
* crosses two events, so the fold keeps the call open until its result arrives.
* @param events - the Agent's durable session events, in order.
* @returns skill names the log proves were loaded.
*/
function loadedSkillsFrom(events) {
	const loaded = /* @__PURE__ */ new Set();
	const pending = /* @__PURE__ */ new Map();
	for (const event of events) {
		if (event.type === "user/message") {
			const source = event.data.source;
			if (source?.kind === "skill-invocation" && typeof source.name === "string") loaded.add(source.name);
			continue;
		}
		if (event.type === "tool/call") {
			const data = event.data;
			if (data.name !== "skill" || typeof data.callId !== "string") continue;
			const skill = skillNameOf(data.arguments);
			if (skill !== void 0) pending.set(data.callId, skill);
			continue;
		}
		if (event.type === "tool/result") {
			const data = event.data;
			const callId = data.message?.toolCallId;
			if (typeof callId !== "string") continue;
			const skill = pending.get(callId);
			if (skill === void 0) continue;
			pending.delete(callId);
			if (data.message?.isError !== true) loaded.add(skill);
		}
	}
	return loaded;
}
/**
* Owns the per-Agent masks and lifts them as skills load.
*
* Every mask is created on `agent.ctx`, so Agent disposal removes it even if
* this plugin is never asked to. The plugin also keeps each disposer so
* unloading lifts masks immediately instead of waiting for Agent teardown.
*/
var SkillGate = class {
	store;
	gates = /* @__PURE__ */ new Map();
	/**
	* Every tool name any Agent has ever been seen with. The settings page reads
	* this so it can offer tools before a session has ever started, and keep
	* offering them after the last session ends.
	*/
	seen = /* @__PURE__ */ new Set();
	constructor(store) {
		this.store = store;
	}
	/**
	* Install the gate for one Agent: mask every bound tool that is currently
	* registered, then unlock whatever the Agent's own log already proves.
	* @param agent - the Agent whose creation triggered this.
	* @param knownTools - tool names visible in that Agent's scope right now.
	*/
	async arm(agent, knownTools) {
		for (const tool of knownTools) this.seen.add(tool);
		const gate = {
			masked: /* @__PURE__ */ new Set(),
			lifts: [],
			unlocked: /* @__PURE__ */ new Set()
		};
		this.gates.set(agent, gate);
		agent.ctx.effect(() => () => {
			this.gates.delete(agent);
		}, "skill-gate.agent");
		const bindings = await this.store.load();
		if (bindings.gated.size === 0) return;
		for (const skill of loadedSkillsFrom(agent.session.snapshotEvents())) gate.unlocked.add(skill);
		const toMask = /* @__PURE__ */ new Set();
		for (const tool of bindings.gated) {
			if (!knownTools.has(tool)) continue;
			if (this.unlockedBy(bindings, gate.unlocked, tool)) continue;
			toMask.add(tool);
		}
		for (const tool of toMask) gate.masked.add(tool);
		this.reapply(agent, gate);
	}
	/**
	* Apply each live Agent's own tool set to its mask, so a tool that registers
	* after an Agent was armed is masked too.
	* @param knownToolsOf - resolves the tool names visible in one Agent's scope.
	*/
	async refresh(knownToolsOf) {
		for (const agent of this.gates.keys()) for (const tool of knownToolsOf(agent)) this.seen.add(tool);
		const bindings = await this.store.load();
		if (bindings.gated.size === 0) return;
		for (const [agent, gate] of this.gates) {
			const knownTools = knownToolsOf(agent);
			const added = /* @__PURE__ */ new Set();
			for (const tool of bindings.gated) {
				if (!knownTools.has(tool) || gate.masked.has(tool)) continue;
				if (this.unlockedBy(bindings, gate.unlocked, tool)) continue;
				added.add(tool);
			}
			if (added.size === 0) continue;
			for (const tool of added) gate.masked.add(tool);
			this.reapply(agent, gate);
		}
	}
	/** Agents currently under the gate, in creation order. */
	agents() {
		return [...this.gates.keys()];
	}
	/** Every tool name this gate has observed in any Agent scope. */
	observed() {
		return this.seen;
	}
	/**
	* Record one successful skill load and lift the tools it unlocks.
	* @param agent - the Agent that loaded the skill.
	* @param skill - the loaded skill name.
	*/
	async unlock(agent, skill) {
		const gate = this.gates.get(agent);
		if (gate === void 0 || gate.unlocked.has(skill)) return;
		gate.unlocked.add(skill);
		const bindings = await this.store.load();
		const tools = bindings.bySkill.get(skill);
		if (tools === void 0) return;
		const release = tools.filter((tool) => gate.masked.has(tool) && !bindings.blockedTools.has(tool));
		if (release.length === 0) return;
		for (const tool of release) gate.masked.delete(tool);
		this.reapply(agent, gate);
	}
	/** Dispose the previous masks and install one for the current hidden set. */
	reapply(agent, gate) {
		for (const lift of gate.lifts.splice(0)) lift();
		if (gate.masked.size === 0) return;
		gate.lifts.push(agent.ctx.tools.restrict({ deny: [...gate.masked] }));
	}
	/** Whether a loaded skill unlocks this tool. */
	unlockedBy(bindings, unlocked, tool) {
		if (bindings.blockedTools.has(tool)) return false;
		for (const skill of unlocked) if (bindings.bySkill.get(skill)?.includes(tool) === true) return true;
		return false;
	}
	/** Drop every live mask. */
	dispose() {
		for (const gate of this.gates.values()) {
			for (const lift of gate.lifts.splice(0)) lift();
			gate.masked.clear();
		}
		this.gates.clear();
	}
};
//#endregion
//#region lib/types/guide.js
/**
* The bundled configuration guide, published as a loadable skill.
*
* The guide is the only thing that tells a model how the gate is configured, so
* it ships as a real Markdown asset next to the built entry (`skill/SKILL.md`,
* listed in `package.json#files`) instead of a string buried in code, and its
* frontmatter carries the same name and description the registration publishes.
*
* A composition without a skill registry, or a package that lost the asset,
* must still boot: this module reports the problem and registers nothing.
*
* @module dsh-skill-gated-tools/guide
*/
/** Skill name the guide registers under; distinct from the maintenance skill `skill-gate`. */
const GUIDE_SKILL_NAME = "skill-gated-tools";
/** Catalog text: what the skill is for, in both languages the user writes in. */
const GUIDE_DESCRIPTION = "工具与技能门控配置指导：把工具绑定到技能、永久屏蔽工具、引用暂时缺失的技能或工具、排查被隐藏的工具为什么不出现。Use when configuring skill-gated tool visibility — binding tools to skills, blocking tools permanently, keeping rules that reference missing skills or tools, or diagnosing a gated tool that never shows up.";
/** The asset, addressed from the built entry in `lib/`. */
const GUIDE_FILE = new URL("../skill/SKILL.md", import.meta.url);
/** The asset's directory, published as the skill's resource base. */
const GUIDE_DIR = new URL("../skill/", import.meta.url);
/** Matches a leading YAML frontmatter block. */
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
/**
* Split a Markdown asset into its frontmatter fields and its body.
*
* Only the flat `key: value` lines this asset uses are read; the block is
* stripped from the body either way, so no frontmatter reaches the model.
* @param markdown - the asset's text.
* @returns frontmatter fields and the remaining body.
*/
function parseGuide(markdown) {
	const match = FRONTMATTER.exec(markdown);
	if (match === null) return {
		fields: {},
		body: markdown
	};
	const fields = {};
	for (const line of (match[1] ?? "").split(/\r?\n/)) {
		const at = line.indexOf(":");
		if (at <= 0) continue;
		fields[line.slice(0, at).trim()] = line.slice(at + 1).trim();
	}
	return {
		fields,
		body: markdown.slice(match[0].length).replace(/^[ \t]*\r?\n/, "")
	};
}
/**
* Read the guide asset.
* @param file - the asset location; defaults to the packaged one.
* @returns the parsed document.
*/
function readGuide(file = GUIDE_FILE) {
	return parseGuide(readFileSync(file, "utf8"));
}
/**
* Publish the guide as a skill on a context whose `skills` service is live.
*
* Registered without a scope, so it lands in the global layer next to the
* registry's own rank. Disposal follows the registration through Cordis.
* @param ctx - context carrying a live `skills` registry.
* @param load - guide loader, overridable so the failure path stays testable.
* @returns the registration's disposer, or a no-op when nothing was registered.
*/
function registerGuideSkill(ctx, load = readGuide) {
	const skills = ctx.get("skills");
	if (skills === void 0) return () => {};
	let guide;
	try {
		guide = load();
	} catch (error) {
		ctx.logger.warn(`skill-gate: bundled guide skill unavailable: ${String(error)}`);
		return () => {};
	}
	if (guide.body.trim() === "") {
		ctx.logger.warn(`skill-gate: bundled guide skill at ${fileURLToPath(GUIDE_FILE)} is empty`);
		return () => {};
	}
	return skills.register({
		name: GUIDE_SKILL_NAME,
		description: GUIDE_DESCRIPTION,
		content: guide.body,
		source: "bundled",
		resourceBase: {
			kind: "directory",
			path: fileURLToPath(GUIDE_DIR)
		}
	});
}
//#endregion
//#region lib/types/index.js
/**
* Plugin entry: wires the binding store, the gate, and the settings route onto
* Harness events.
*
* The plugin observes Agent creation and `skill` tool results; it never
* registers a tool of its own and never modifies another plugin's
* registration.
*
* @module dsh-skill-gated-tools
*/
var __addDisposableResource = function(env, value, async) {
	if (value !== null && value !== void 0) {
		if (typeof value !== "object" && typeof value !== "function") throw new TypeError("Object expected.");
		var dispose, inner;
		if (async) {
			if (!Symbol.asyncDispose) throw new TypeError("Symbol.asyncDispose is not defined.");
			dispose = value[Symbol.asyncDispose];
		}
		if (dispose === void 0) {
			if (!Symbol.dispose) throw new TypeError("Symbol.dispose is not defined.");
			dispose = value[Symbol.dispose];
			if (async) inner = dispose;
		}
		if (typeof dispose !== "function") throw new TypeError("Object not disposable.");
		if (inner) dispose = function() {
			try {
				inner.call(this);
			} catch (e) {
				return Promise.reject(e);
			}
		};
		env.stack.push({
			value,
			dispose,
			async
		});
	} else if (async) env.stack.push({ async: true });
	return value;
};
var __disposeResources = (function(SuppressedError) {
	return function(env) {
		function fail(e) {
			env.error = env.hasError ? new SuppressedError(e, env.error, "An error was suppressed during disposal.") : e;
			env.hasError = true;
		}
		var r, s = 0;
		function next() {
			while (r = env.stack.pop()) try {
				if (!r.async && s === 1) return s = 0, env.stack.push(r), Promise.resolve().then(next);
				if (r.dispose) {
					var result = r.dispose.call(r.value);
					if (r.async) return s |= 2, Promise.resolve(result).then(next, function(e) {
						fail(e);
						return next();
					});
				} else s |= 1;
			} catch (e) {
				fail(e);
			}
			if (s === 1) return env.hasError ? Promise.reject(env.error) : Promise.resolve();
			if (env.hasError) throw env.error;
		}
		return next();
	};
})(typeof SuppressedError === "function" ? SuppressedError : function(error, suppressed, message) {
	var e = new Error(message);
	return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
});
const name = "skill-gate";
const inject = ["tools", "agents"];
/** Configuration schema. */
const Config = Schema.object({
	bindingPath: Schema.string().description("Absolute path of the binding document."),
	settingsRoute: Schema.boolean().default(true).description("Serve the settings REST surface.")
});
/** Tool names visible in one Agent's scope, as the gate needs them. */
function toolsOf(ctx, agent) {
	return new Set(ctx.tools.schemas(scopeOf(agent.ctx)).map((schema) => schema.name));
}
/**
* Every skill name the settings page can offer.
*
* A bare `list()` reads the global layer with no `cwd`, which misses both
* project roots and any provider mounted by an Agent preset — the standard
* preset mounts `skill-filesystem` itself, so the global layer often holds
* nothing at all. Three views are therefore merged:
*
* - the global layer, with the deployment's default directory as `cwd`;
* - the default preset's scope, borrowed for the duration of this read so the
*   page works before any session exists;
* - each live Agent's own scope with its resolved working directory.
* @param ctx - context supplying the skill registry, working directory, and preset registry.
* @param agents - every live Agent, or a snapshot of them.
* @returns the union of every view's skill names, name-sorted.
*/
async function skillPanorama(ctx, agents) {
	const names = /* @__PURE__ */ new Set();
	const collect = async (view) => {
		const skills = ctx.get("skills");
		if (skills === void 0) return;
		for (const skill of await skills.list(view)) names.add(skill.name);
	};
	const workingDirectory = ctx.get("workingDirectory");
	const defaultCwd = workingDirectory?.defaultDirectory;
	await collect(defaultCwd === void 0 ? {} : { cwd: defaultCwd });
	const presets = ctx.get("agentPresets");
	if (presets !== void 0) try {
		const env_1 = {
			stack: [],
			error: void 0,
			hasError: false
		};
		try {
			await collect({
				scope: __addDisposableResource(env_1, await presets.acquireScope(), true).key,
				...defaultCwd === void 0 ? {} : { cwd: defaultCwd }
			});
		} catch (e_1) {
			env_1.error = e_1;
			env_1.hasError = true;
		} finally {
			const result_1 = __disposeResources(env_1);
			if (result_1) await result_1;
		}
	} catch (error) {
		ctx.logger.warn(`skill-gate: default preset skill view skipped: ${String(error)}`);
	}
	for (const agent of agents) try {
		const cwd = workingDirectory === void 0 ? void 0 : await workingDirectory.ensure(agent);
		await collect({
			scope: scopeOf(agent.ctx),
			...cwd === void 0 ? {} : { cwd }
		});
	} catch (error) {
		ctx.logger.warn(`skill-gate: skill view for ${String(agent.id)} skipped: ${String(error)}`);
	}
	return [...names].sort();
}
/** Read a cold default-preset catalog, independent of any live Agent or skill history. */
async function startupToolNames(ctx) {
	const env_2 = {
		stack: [],
		error: void 0,
		hasError: false
	};
	try {
		const presets = ctx.get("agentPresets");
		if (presets === void 0) throw new Error("default preset service is unavailable");
		const lease = __addDisposableResource(env_2, await presets.acquireScope(), true);
		return new Set(ctx.tools.schemas(lease.key).map((schema) => schema.name));
	} catch (e_2) {
		env_2.error = e_2;
		env_2.hasError = true;
	} finally {
		const result_2 = __disposeResources(env_2);
		if (result_2) await result_2;
	}
}
/**
* Install the gate.
* @param ctx - plugin context supplying the tool registry and Agent registry.
* @param config - optional binding-document override.
*/
function apply(ctx, config = {}) {
	const profile = ctx.get("profileContext");
	const legacyPath = defaultBindingPath();
	const store = new BindingStore(config.bindingPath ?? (profile === void 0 ? legacyPath : profileBindingPath(profile.dir)));
	const locations = profile === void 0 ? void 0 : {
		legacyPath,
		profileName: profile.name,
		...store.file === legacyPath ? {} : { legacy: new BindingStore(legacyPath) }
	};
	const gate = new SkillGate(store);
	ctx.effect(() => () => {
		gate.dispose();
	}, "skill-gate");
	/**
	* Every tool name the settings page can offer: the unscoped view, the
	* default preset's composition, every live Agent's scope, and everything the
	* gate has seen in a scope before. A composition that mounts a preset per
	* Agent registers its tools in the preset and Agent scopes, so the unscoped
	* view alone is empty before the first session.
	* @returns every visible tool name.
	*/
	const toolPanorama = async () => {
		const names = new Set(ctx.tools.schemas().map((schema) => schema.name));
		for (const name of gate.observed()) names.add(name);
		const presets = ctx.get("agentPresets");
		if (presets !== void 0) try {
			const env_3 = {
				stack: [],
				error: void 0,
				hasError: false
			};
			try {
				const lease = __addDisposableResource(env_3, await presets.acquireScope(), true);
				for (const schema of ctx.tools.schemas(lease.key)) names.add(schema.name);
			} catch (e_3) {
				env_3.error = e_3;
				env_3.hasError = true;
			} finally {
				const result_3 = __disposeResources(env_3);
				if (result_3) await result_3;
			}
		} catch (error) {
			ctx.logger.warn(`skill-gate: default preset tool view skipped: ${String(error)}`);
		}
		for (const agent of gate.agents()) for (const name of toolsOf(ctx, agent)) names.add(name);
		return names;
	};
	if (config.settingsRoute !== false) ctx.inject(["webServer"], (scope) => {
		const skillNames = scope.get("skills") === void 0 ? void 0 : () => skillPanorama(scope, [...gate.agents()]);
		mountApi(scope, store, scope.get("webServer"), toolPanorama, skillNames, () => scope.get("connection"), () => startupToolNames(scope), locations);
	});
	ctx.inject(["skills"], (scope) => {
		mountClaudeSkills(scope);
		registerGuideSkill(scope);
	});
	const report = (operation) => (error) => {
		ctx.logger.warn(`skill-gate: ${operation} failed, tools stay visible: ${String(error)}`);
	};
	ctx.on("agent/created", async ({ agent }) => {
		await gate.arm(agent, toolsOf(ctx, agent)).catch(report(`arming ${String(agent.id)}`));
	});
	ctx.on("tools/change", () => {
		gate.refresh((agent) => toolsOf(ctx, agent)).catch(report("refresh after tools/change"));
	});
	ctx.on("tools/post-execute", async (exec, result, next) => {
		const decision = await next();
		if (exec.name !== "skill" || result.isError) return decision;
		const agent = exec.agent;
		if (agent === void 0) return decision;
		const skill = skillNameOf(exec.arguments);
		if (skill === void 0) return decision;
		await gate.unlock(agent, skill).catch(report(`unlocking ${skill}`));
		return decision;
	});
}
//#endregion
export { Config, apply, inject, name, startupToolNames };
