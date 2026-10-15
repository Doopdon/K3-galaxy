// K3's galactic bloom/fog look, adapted to the normal-script Three.js r128 build.
class K3GalaxyEffects {
    constructor(game) {
        this.game = game;
        this.available = !!(THREE.EffectComposer && THREE.UnrealBloomPass && THREE.ShaderPass);
        if (!this.available) {
            console.warn("Galaxy bloom unavailable; using normal rendering.");
            return;
        }
        const settings = K3_COLORS.galaxyEffects;
        this.composer = new THREE.EffectComposer(game.renderer);
        // Bloom only the galactic layer. Closer layers are drawn once, sharply,
        // onto the finished image after the composer restores the screen target.
        const source = new THREE.Pass();
        source.needsSwap = false;
        source.render = (renderer, writeBuffer, readBuffer) => {
            renderer.setRenderTarget(readBuffer);
            game.renderLayerStack(0, 1);
        };
        this.composer.addPass(source);
        this.bloom = new THREE.UnrealBloomPass(new THREE.Vector2(1, 1),
            settings.bloomStrength, settings.bloomRadius, settings.bloomThreshold);
        this.composer.addPass(this.bloom);
        this.fog = new THREE.FogExp2(0x000003, settings.fogDensity);
        this.resize(window.innerWidth, window.innerHeight);
    }

    resize(width, height) {
        if (this.available) {
            // Keep the screen-space blur affordable on high-DPI displays.
            this.composer.setPixelRatio(Math.min(this.game.renderer.getPixelRatio(), 1.5));
            this.composer.setSize(width, height);
        }
    }

    render() {
        if (!this.available) return false;
        const { renderer, layers } = this.game;
        const settings = K3_COLORS.galaxyEffects;
        this.bloom.strength = settings.bloomStrength;
        this.bloom.radius = settings.bloomRadius;
        this.bloom.threshold = settings.bloomThreshold;
        this.fog.density = settings.fogDensity;
        const previous = {
            toneMapping: renderer.toneMapping, exposure: renderer.toneMappingExposure,
            target: renderer.getRenderTarget(), fog: layers[0].scene.fog
        };
        try {
            renderer.toneMapping = THREE.ACESFilmicToneMapping;
            renderer.toneMappingExposure = settings.exposure;
            layers[0].scene.fog = this.fog;
            this.composer.render();
        } finally {
            renderer.setRenderTarget(previous.target);
            renderer.toneMapping = previous.toneMapping;
            renderer.toneMappingExposure = previous.exposure;
            layers[0].scene.fog = previous.fog;
        }
        return true;
    }
}
