"use strict";

async function instantiate(id, parent) {
	let template = document.getElementById(id);
	let base = location.href;
	if (template.dataset.location) {
		// TODO: cache
		base = new URL(template.dataset.location, base);
		let response = await fetch(template.dataset.location);
		let doc = new DOMParser().parseFromString(await response.text(), "text/html")
		template = doc.getElementById(id);
	}
	let wrapper = document.createElement('div');
	wrapper.innerHTML = template.innerHTML;
	var el = wrapper.firstElementChild;

	let mod = template.dataset.import;
	if (mod) {
		await import(new URL(mod, base));
	}
	(parent || document.querySelector("a-scene")).appendChild(el);
	return el;
}

AFRAME.registerComponent('instantiate-on-click', {
	schema: {
		template: { type: 'string', default: "" },
		id: { type: 'string', default: "" },
		align: { type: 'string', default: "" }
	},
	init() {
		this.el.addEventListener('click', async (ev) => {
			if (this.data.id && document.getElementById(this.data.id)) {
				return;
			}
			let el = await instantiate(this.data.template);
			if (this.data.id) {
				el.id = this.data.id;
			}
			if (this.data.align == "raycaster") {
				if (!ev.detail.cursorEl || !ev.detail.cursorEl.components.raycaster) {
					return;
				}
				var raycaster = ev.detail.cursorEl.components.raycaster.raycaster;
				var rot = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), raycaster.ray.direction);
				var origin = raycaster.ray.origin;

				el.addEventListener('loaded', function onLoaded(ev) {
					el.removeEventListener('loaded', onLoaded, false);
					let pos = new THREE.Vector3().add(el.getAttribute("position")).applyQuaternion(rot);
					el.setAttribute("position", pos.add(origin));
					el.object3D.quaternion.copy(rot);
				}, false);
			}
		});
	}
});


AFRAME.registerComponent('position-controls', {
	schema: {
		arrowkeys: { default: "rotation" },
		wasdkeys: { default: "translation" },
		axismove: { default: "translation" },
		speed: { default: 0.1 },
		rotationSpeed: { default: 0.1 }
	},
	init: function () {
		let data = this.data;
		if (data.arrowkeys || data.wasdkeys) {
			let fns = {
				rotation: [
					(o) => o.rotateY(-data.rotationSpeed),
					(o) => o.rotateY(data.rotationSpeed),
					(o) => o.rotateX(-data.rotationSpeed),
					(o) => o.rotateX(data.rotationSpeed),
					(o) => o.quaternion.set(0, 0, 0, 1)
				],
				translation: [
					(o) => o.translateX(-data.speed),
					(o) => o.translateX(data.speed),
					(o) => o.translateZ(data.speed),
					(o) => o.translateZ(-data.speed),
					(o) => o.position.set(0, 0, 0)
				]
			};
			let arrowKeyFns = fns[data.arrowkeys] || [];
			let wasdKeyFns = fns[data.wasdkeys] || [];
			document.addEventListener('keydown', ev => {
				if (document.activeElement != document.body) {
					return;
				}
				switch (ev.code) {
					case "ArrowRight":
						arrowKeyFns[0] && arrowKeyFns[0](this.el.object3D);
						break;
					case "ArrowLeft":
						arrowKeyFns[1] && arrowKeyFns[1](this.el.object3D);
						break;
					case "ArrowDown":
						arrowKeyFns[2] && arrowKeyFns[2](this.el.object3D);
						break;
					case "ArrowUp":
						arrowKeyFns[3] && arrowKeyFns[3](this.el.object3D);
						break;
					case "Space":
						arrowKeyFns[4] && arrowKeyFns[4](this.el.object3D);
						break;
					case "KeyA":
						wasdKeyFns[0] && wasdKeyFns[0](this.el.object3D);
						break;
					case "KeyD":
						wasdKeyFns[1] && wasdKeyFns[1](this.el.object3D);
						break;
					case "KeyS":
						wasdKeyFns[2] && wasdKeyFns[2](this.el.object3D);
						break;
					case "KeyW":
						wasdKeyFns[3] && wasdKeyFns[3](this.el.object3D);
						break;
				}
			});
		}
		document.addEventListener('wheel', ev => {
			let speedFactor = 0.01;
			var camera = this.el.sceneEl.camera;
			var forward = camera.getWorldDirection(new THREE.Vector3());
			forward.y = 0;
			forward.normalize();
			this.el.object3D.position.add(forward.multiplyScalar(-ev.deltaY * speedFactor));
		});
		this.changed = [];
		this.el.addEventListener('gripdown', ev => {
			document.querySelectorAll("[xy-drag-control]").forEach(el => {
				this.changed.push([el, Object.assign({}, el.getAttribute('xy-drag-control'))]);
				el.setAttribute("xy-drag-control", { mode: "pull", autoRotate: false });
			});
		});
		this.el.addEventListener('gripup', ev => {
			this.changed.forEach(([el, dragControl]) => {
				el.setAttribute("xy-drag-control", { mode: dragControl.mode, autoRotate: dragControl.autoRotate });
			});
			this.changed = [];
		});
		this.el.querySelectorAll('[laser-controls]').forEach(el => el.addEventListener('axismove', ev => {
			let direction = ev.target.components.raycaster.raycaster.ray.direction;
			if (this.data.axismove == "translation") {
				let rot = Math.atan2(direction.x, direction.z);
				let v = new THREE.Vector3(-ev.detail.axis[0], 0, -ev.detail.axis[1]).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);
				this.el.object3D.position.add(v.multiplyScalar(this.data.speed));
			} else if (this.data.axismove == "rotation") {
				this.el.object3D.rotateY(-ev.detail.axis[0] * this.data.rotationSpeed * 0.1);
			} else {
				let rot = Math.atan2(direction.x, direction.z);
				let v = new THREE.Vector3(0, 0, -ev.detail.axis[1]).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);
				this.el.object3D.position.add(v.multiplyScalar(this.data.speed));
				this.el.object3D.rotateY(-ev.detail.axis[0] * this.data.rotationSpeed * 0.1);
			}
		}));
	}
});


AFRAME.registerComponent('fill-parent', {
	dependencies: ['xyrect'],
	schema: {},
	async init() {
		this.el.setAttribute("xyitem", { fixed: true });
		this.el.parentNode.addEventListener('xyresize', (ev) => {
			this.el.setAttribute("geometry", { width: ev.detail.xyrect.width, height: ev.detail.xyrect.height });
			this.el.setAttribute('xyrect', { width: ev.detail.xyrect.width, height: ev.detail.xyrect.height });
		});


		if (!this.el.parentNode.hasLoaded) {
			await new Promise((resolve, _) => this.el.parentNode.addEventListener('loaded', resolve, { once: true }));
		}

		let rect = this.el.parentNode.components.xyrect;
		if (rect) {
			this.el.setAttribute("geometry", { width: rect.width, height: rect.height });
		}
	},
	remove() {
	}
});


AFRAME.registerShader('msdf2', {
	schema: {
		diffuse: { type: 'color', is: 'uniform', default: "#ffffff" },
		opacity: { type: 'number', is: 'uniform', default: 1.0 },
		src: { type: 'map', is: 'uniform' },
		offset: { type: 'vec2', is: 'uniform', default: { x: 0, y: 0 } },
		repeat: { type: 'vec2', is: 'uniform', default: { x: 1, y: 1 } },
		msdfUnit: { type: 'vec2', is: 'uniform', default: { x: 0.03, y: 0.03 } },
	},
	init: function (data) {
		this.attributes = this.initVariables(data, 'attribute');
		this.uniforms = THREE.UniformsUtils.merge([this.initVariables(data, 'uniform'), THREE.UniformsLib.fog]);
		this.material = new THREE.ShaderMaterial({
			uniforms: this.uniforms,
			vertexShader: this.vertexShader,
			fragmentShader: this.fragmentShader,
			flatShading: true,
			fog: true
		});
	},
	vertexShader: `
	#define USE_MAP
	#define USE_UV
	#include <common>
	#include <uv_pars_vertex>
	#include <color_pars_vertex>
	#include <fog_pars_vertex>
	#include <clipping_planes_pars_vertex>
	uniform vec2 offset;
	uniform vec2 repeat;
	void main() {
		vUv = uv * repeat + offset;
		#include <color_vertex>
		#include <begin_vertex>
		#include <project_vertex>
		#include <worldpos_vertex>
		#include <clipping_planes_vertex>
		#include <fog_vertex>
	}`,
	fragmentShader: `
	#extension GL_OES_standard_derivatives : enable
	uniform vec3 diffuse;
	uniform float opacity;
	uniform vec2 msdfUnit;
	uniform sampler2D src;
	#define USE_MAP
	#define USE_UV
	#include <common>
	#include <color_pars_fragment>
	#include <uv_pars_fragment>
	#include <fog_pars_fragment>
	#include <clipping_planes_pars_fragment>
	float median(float r, float g, float b) {
		return max(min(r, g), min(max(r, g), b));
	}
	void main() {
		#include <clipping_planes_fragment>
		vec4 sample = texture2D( src, vUv );
		float sigDist = median(sample.r, sample.g, sample.b) - 0.5;
		sigDist *= dot(msdfUnit, 0.5/fwidth(vUv));

		vec4 diffuseColor = vec4( diffuse, opacity * clamp(sigDist + 0.5, 0.0, 1.0));
		#include <color_fragment>
		#include <alphatest_fragment>
		gl_FragColor = diffuseColor;
		#include <fog_fragment>
	}`
});

AFRAME.registerComponent('atlas', {
	schema: {
		src: { default: "" },
		index: { default: 0 },
		cols: { default: 1 },
		rows: { default: 1 },
		margin: { default: 0.01 }
	},
	update() {
		let u = (this.data.index % this.data.cols + this.data.margin) / this.data.cols;
		let v = (this.data.rows - 1 - Math.floor(this.data.index / this.data.cols) + this.data.margin) / this.data.rows;
		this.el.setAttribute("material", {
			shader: 'msdf2',
			npot: true,
			transparent: true,
			repeat: { x: 1 / this.data.cols - this.data.margin, y: 1 / this.data.rows - this.data.margin },
			src: this.data.src
		});
		this.el.setAttribute("material", "offset", { x: u, y: v });
	},
});

AFRAME.registerComponent('fish', {
	schema: {
	},
	init() {
		this.el.addEventListener('mouseenter', () => {
			this.startRandom();
		});

		this.startRandom();
	},
	tick() {
		let p = this.el.object3D.position.clone();
		this.el.object3D.position.lerp(this.targetPos, 0.005);
		this.el.object3D.lookAt(p.sub(this.el.object3D.position).negate().add(this.el.object3D.position));
	},
	setTargetPos(p) {
		this.targetPos = p;
	},
	startRandom() {
		clearTimeout(this.timer);
		this.setTargetPos(new THREE.Vector3(Math.random() * 5 - 2.5, Math.random() + 1, Math.random() * 5 - 2.5));
		this.timer = setTimeout(() => this.startRandom(), Math.random() * 3000 + 1000);
	}
});

AFRAME.registerComponent('main-menu', {
	schema: {
	},
	init: function () {
	},
	remove: function () {
	},
	_getEl(name) {
		return this.el.querySelector("[name=" + name + "]");
	}
});
