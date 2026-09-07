"""torch-only stand-in for the torchvision.transforms that hy3dgen's DINO conditioner uses (the ROCm venv has no
torchvision: the PyPI wheel is built against a CUDA torch). setup.sh copies this to hy3dgen/shapegen/models/_tv_compat.py."""
import torch
import torch.nn.functional as F


class InterpolationMode:
    BILINEAR = 'bilinear'
    BICUBIC = 'bicubic'


class Compose:
    def __init__(self, ts):
        self.ts = ts

    def __call__(self, x):
        for t in self.ts:
            x = t(x)
        return x


class Resize:
    def __init__(self, size, interpolation='bilinear', antialias=True):
        self.size = (size, size) if isinstance(size, int) else tuple(size)
        self.mode, self.antialias = interpolation, antialias

    def __call__(self, x):
        squeeze = x.dim() == 3
        if squeeze:
            x = x[None]
        x = F.interpolate(x, size=self.size, mode=self.mode, align_corners=False, antialias=self.antialias)
        return x[0] if squeeze else x


class CenterCrop:
    def __init__(self, size):
        self.size = (size, size) if isinstance(size, int) else tuple(size)

    def __call__(self, x):
        h, w = x.shape[-2:]
        th, tw = self.size
        top, left = max(0, (h - th) // 2), max(0, (w - tw) // 2)
        return x[..., top:top + th, left:left + tw]


class Normalize:
    def __init__(self, mean, std):
        self.mean, self.std = torch.tensor(mean).view(-1, 1, 1), torch.tensor(std).view(-1, 1, 1)

    def __call__(self, x):
        return (x - self.mean.to(x)) / self.std.to(x)


class transforms:  # namespace mirror of torchvision.transforms
    InterpolationMode, Compose, Resize, CenterCrop, Normalize = InterpolationMode, Compose, Resize, CenterCrop, Normalize
