import { EffectComposer, Bloom, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { IS_MOBILE } from "./config";

function KuruPostProcessing() {
  if (IS_MOBILE) {
    return (
      <EffectComposer>
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
    );
  }

  return (
    <EffectComposer>
      <Bloom
        intensity={1.0}
        luminanceThreshold={0.7}
        luminanceSmoothing={0.4}
        mipmapBlur
      />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}

export default KuruPostProcessing;
