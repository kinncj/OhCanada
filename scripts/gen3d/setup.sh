#!/usr/bin/env bash
# One-shot environment for the local text-to-3D hero asset pipeline (AMD ROCm, Python 3.14 system torch).
#   SCRATCH=<dir> scripts/gen3d/setup.sh
# Creates $SCRATCH/gen3d/venv (--system-site-packages so the ROCm torch from /usr is reused, never a CUDA torch)
# and clones Hunyuan3D-2 into $SCRATCH/gen3d/Hunyuan3D-2 (patched: torchvision-free DINO conditioner).
# Weights and per-asset working files live in $GEN3D_DISK_CACHE (default ~/.cache/truenorth-gen3d) because the
# scratchpad is a RAM-backed tmpfs that is cleared between sessions — re-running this script is then a 2 min no-op.
# Nothing is written into the repository.
set -euo pipefail
SCRATCH=${SCRATCH:?set SCRATCH to the scratchpad directory}
ROOT=$SCRATCH/gen3d
DISK_CACHE=${GEN3D_DISK_CACHE:-$HOME/.cache/truenorth-gen3d}
HERE=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$ROOT" "$DISK_CACHE/hf" "$DISK_CACHE/work"

cat > "$ROOT/env.sh" <<ENV
export SCR=$SCRATCH
export GEN3D_DISK_CACHE=$DISK_CACHE
export HF_HOME=$DISK_CACHE/hf
export GEN3D_WORK=$DISK_CACHE/work
export HF_HUB_ENABLE_HF_TRANSFER=0
export VENV=$ROOT/venv
export HY3D=$ROOT/Hunyuan3D-2
export PYTHONUNBUFFERED=1
export TOKENIZERS_PARALLELISM=false
export PYTORCH_ROCM_ARCH=gfx1151
export PYTHONPATH=$ROOT/Hunyuan3D-2:\${PYTHONPATH:-}
if [ -f \$VENV/bin/activate ]; then source \$VENV/bin/activate; fi
ENV
source "$ROOT/env.sh"

if [ ! -x "$VENV/bin/python" ]; then
  uv venv --system-site-packages --python /usr/bin/python3 "$VENV"
fi
# uv cannot see system site-packages while resolving, so anything declaring a torch dependency would drag in a CUDA
# torch: install those --no-deps and name their real (pure Python) dependencies explicitly.
# coverage>=7.6: numba (pulled in by rembg/pymatting) crashes against the older system coverage module.
uv pip install --python "$VENV/bin/python" \
  numpy scipy pillow safetensors einops omegaconf pyyaml tqdm regex requests filelock packaging psutil \
  huggingface_hub tokenizers sentencepiece protobuf trimesh scikit-image pygltflib opencv-python-headless \
  pymeshlab xatlas pymeshfix rembg onnxruntime "coverage>=7.6"
uv pip install --python "$VENV/bin/python" --no-deps diffusers transformers accelerate
# Guard: the venv must resolve to the ROCm torch from /usr, not a CUDA wheel.
"$VENV/bin/python" - <<'PY'
import torch
assert torch.version.hip and torch.cuda.is_available(), f'expected the system ROCm torch, got {torch.__file__}'
print('torch', torch.__version__, 'hip', torch.version.hip, torch.cuda.get_device_name(0))
PY

if [ ! -d "$HY3D" ]; then
  git clone --depth 1 https://github.com/Tencent-Hunyuan/Hunyuan3D-2.git "$HY3D"
fi
# hy3dgen imports torchvision only for Resize/CenterCrop/Normalize, and the torchvision wheel is built against CUDA torch.
cp "$HERE/tv_compat.py" "$HY3D/hy3dgen/shapegen/models/_tv_compat.py"
sed -i 's/^from torchvision import transforms$/from ._tv_compat import transforms/' "$HY3D/hy3dgen/shapegen/models/conditioner.py"
"$VENV/bin/python" -c "import hy3dgen.shapegen; print('hy3dgen.shapegen OK')"

# Weights (~15 GB; one --include per pattern, hf treats extra positionals as literal filenames).
hf download tencent/Hunyuan3D-2mini --include "hunyuan3d-dit-v2-mini-turbo/*" --include "hunyuan3d-vae-v2-mini-turbo/*" --include "*.json"
hf download stabilityai/sdxl-turbo --include "*.json" --include "*.txt" --include "tokenizer/*" --include "tokenizer_2/*" --include "scheduler/*" \
  --include "text_encoder/model.fp16.safetensors" --include "text_encoder_2/model.fp16.safetensors" \
  --include "unet/diffusion_pytorch_model.fp16.safetensors" --include "vae/diffusion_pytorch_model.fp16.safetensors"
hf download briaai/RMBG-1.4 --include "*.py" --include "*.json" --include "model.safetensors"
echo "setup complete: source $ROOT/env.sh"
