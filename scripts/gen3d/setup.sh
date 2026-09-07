#!/usr/bin/env bash
# One-shot environment for the local text-to-3D hero asset pipeline (AMD ROCm, Python 3.14 system torch).
#   SCRATCH=<dir> scripts/gen3d/setup.sh
# Creates $SCRATCH/gen3d/venv (system-site-packages so the ROCm torch from /usr is reused, never a CUDA torch),
# clones Hunyuan3D-2 into $SCRATCH/gen3d/Hunyuan3D-2 (patched: torchvision-free DINO conditioner), and downloads
# the weights into $SCRATCH/hf (a symlink to ~/.cache/truenorth-gen3d/hf: /tmp is a RAM-backed tmpfs on this box,
# 15 GB of weights there took the machine down once). Nothing is written into the repository.
set -euo pipefail
SCRATCH=${SCRATCH:?set SCRATCH to the scratchpad directory}
ROOT=$SCRATCH/gen3d
mkdir -p "$ROOT"
DISK_CACHE=${GEN3D_DISK_CACHE:-$HOME/.cache/truenorth-gen3d}
mkdir -p "$DISK_CACHE/hf"
[ -e "$SCRATCH/hf" ] || ln -s "$DISK_CACHE/hf" "$SCRATCH/hf"

cat > "$ROOT/env.sh" <<ENV
export SCR=$SCRATCH
export HF_HOME=$SCRATCH/hf
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
# uv does not see system site-packages while resolving, so anything depending on torch would pull a CUDA torch:
# install those with --no-deps and list their real (pure Python) dependencies explicitly.
uv pip install --python "$VENV/bin/python" \
  numpy scipy pillow safetensors einops omegaconf pyyaml tqdm regex requests filelock packaging psutil \
  huggingface_hub tokenizers sentencepiece protobuf trimesh scikit-image pygltflib opencv-python-headless \
  pymeshlab xatlas pymeshfix rembg onnxruntime "coverage>=7.6"  # coverage: numba (via rembg/pymatting) breaks on the old system coverage module
uv pip install --python "$VENV/bin/python" --no-deps diffusers transformers accelerate
# Guard: the venv must resolve to the ROCm torch from /usr.
"$VENV/bin/python" - <<'PY'
import torch, sys
assert torch.version.hip and torch.cuda.is_available(), 'expected the system ROCm torch'
print('torch', torch.__version__, 'hip', torch.version.hip, torch.cuda.get_device_name(0), 'from', torch.__file__)
PY

if [ ! -d "$HY3D" ]; then
  git clone --depth 1 https://github.com/Tencent-Hunyuan/Hunyuan3D-2.git "$HY3D"
fi
# hy3dgen only uses torchvision for Resize/CenterCrop/Normalize; the PyPI torchvision wheel is built against CUDA torch.
cp "$(dirname "$0")/tv_compat.py" "$HY3D/hy3dgen/shapegen/models/_tv_compat.py"
sed -i 's/^from torchvision import transforms$/from ._tv_compat import transforms/' "$HY3D/hy3dgen/shapegen/models/conditioner.py"
"$VENV/bin/python" -c "import hy3dgen.shapegen; print('hy3dgen.shapegen OK')"

# Weights (one --include per pattern: hf treats extra positionals as literal filenames).
hf download tencent/Hunyuan3D-2mini --include "hunyuan3d-dit-v2-mini-turbo/*" --include "hunyuan3d-vae-v2-mini-turbo/*" --include "*.json"
hf download stabilityai/sdxl-turbo --include "*.json" --include "*.txt" --include "tokenizer/*" --include "tokenizer_2/*" --include "scheduler/*" \
  --include "text_encoder/model.fp16.safetensors" --include "text_encoder_2/model.fp16.safetensors" \
  --include "unet/diffusion_pytorch_model.fp16.safetensors" --include "vae/diffusion_pytorch_model.fp16.safetensors"
hf download briaai/RMBG-1.4 --include "*.py" --include "*.json" --include "model.safetensors"
echo "setup complete: source $ROOT/env.sh"
