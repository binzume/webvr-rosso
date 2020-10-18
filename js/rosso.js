"use strict";

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
