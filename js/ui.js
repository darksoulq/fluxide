const h = (tag, props = {}, children = []) => {
	const isSvg = ['svg', 'path', 'defs', 'marker', 'polygon', 'polyline', 'circle', 'rect', 'line', 'text'].includes(tag);
	const el = isSvg ? document.createElementNS('http://www.w3.org/2000/svg', tag) : document.createElement(tag);
	
	for (let k in props) {
		if (k.startsWith('on') && typeof props[k] === 'function') {
			el.addEventListener(k.substring(2).toLowerCase(), props[k]);
		} else if (k === 'style' && typeof props[k] === 'object') {
			Object.assign(el.style, props[k]);
		} else if (k === 'class' || k === 'className') {
			if (isSvg) el.setAttribute('class', props[k]); else el.className = props[k];
		} else if (k === 'dataset' && typeof props[k] === 'object') {
			for(let d in props[k]) el.dataset[d] = props[k][d];
		} else if (typeof props[k] === 'boolean') { 
			if (props[k]) el.setAttribute(k, ''); 
		} else if (props[k] !== undefined && props[k] !== null && k !== 'innerHTML') {
			el.setAttribute(k, props[k]);
		}
	}
	
	const append = (c) => {
		if (Array.isArray(c)) c.forEach(append);
		else if (c instanceof Node) el.appendChild(c);
		else if (c !== null && c !== undefined && c !== false) el.appendChild(document.createTextNode(c));
	};
	if(props.innerHTML) el.innerHTML = props.innerHTML; else append(children);
	return el;
};