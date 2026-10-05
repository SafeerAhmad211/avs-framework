---
name: ltx-video
description: Install, run, and troubleshoot Lightricks LTX-Video (DiT text-to-video / image-to-video / video-to-video / keyframe & video-extension model). Load when the user wants to generate video with LTX-Video or LTXV, run `inference.py`, pick an `ltxv-*.yaml` pipeline config, condition on images/videos, set up its Python env, or debug its OOM/download/frame-count errors. Not for LTX-2 (audio+video; separate repo Lightricks/LTX-2) or ComfyUI workflows.
---

# LTX-Video

Upstream: https://github.com/Lightricks/LTX-Video (package `ltx-video` 0.1.2, Apache-2.0 code).
Verified against commit `4b2d053` (2026-10-05). Upstream now points new work to **LTX-2**
(https://github.com/Lightricks/LTX-2); use that instead if the user needs synchronized audio.

## When NOT to use
- Audio+video, IC-LoRA, LTX-2 models → LTX-2 repo.
- Training / LoRA fine-tuning → https://github.com/Lightricks/LTX-Video-Trainer.
- Upstream itself says ComfyUI (ComfyUI-LTXVideo) gives better quality than `inference.py`.

## 1. Install

Requirements: Python >= 3.10. Tested upstream with Python 3.10.5 + CUDA 12.2, PyTorch >= 2.1.2.
macOS MPS: PyTorch == 2.3 or >= 2.6. Realistically an NVIDIA GPU is needed (CPU works for unit tests only).

```bash
git clone https://github.com/Lightricks/LTX-Video.git
cd LTX-Video
python -m venv env && source env/bin/activate
python -m pip install -e ".[inference]"        # add ,test for pytest
# CPU-only box (tests only): install torch first from the CPU index
#   pip install --index-url https://download.pytorch.org/whl/cpu torch torchvision
python -c "import ltx_video, torch; print(torch.__version__, torch.cuda.is_available())"
```

Pinned deps worth knowing: `transformers>=4.47.2,<4.52.0`, `huggingface-hub~=0.30`, `diffusers>=0.28.2`.
Optional FP8 kernels (Ada GPUs and newer): https://github.com/Lightricks/LTXVideo-Q8-Kernels.

## 2. Run

Always pass `--pipeline_config` — the built-in default (`configs/ltxv-13b-0.9.7-dev.yaml`) **does not exist** in the repo.

```bash
# text-to-video
python inference.py --prompt "PROMPT" --height 704 --width 1216 --num_frames 121 --seed 42 \
  --pipeline_config configs/ltxv-13b-0.9.8-distilled.yaml

# image-to-video (image at frame 0)
python inference.py --prompt "PROMPT" --conditioning_media_paths img.png --conditioning_start_frames 0 \
  --height 704 --width 1216 --num_frames 121 --seed 42 --pipeline_config configs/ltxv-13b-0.9.8-distilled.yaml

# multi-keyframe: lists are space-separated and must have equal length
python inference.py --prompt "PROMPT" --conditioning_media_paths a.png b.png \
  --conditioning_start_frames 0 120 --conditioning_strengths 1.0 0.8 \
  --num_frames 121 --pipeline_config configs/ltxv-13b-0.9.8-distilled.yaml

# video extension: conditioning video must have 8N+1 frames (9, 17, 25, …)
python inference.py --prompt "PROMPT" --conditioning_media_paths clip.mp4 --conditioning_start_frames 0 \
  --num_frames 161 --pipeline_config configs/ltxv-13b-0.9.8-distilled.yaml

# video-to-video
python inference.py --prompt "PROMPT" --input_media_path in.mp4 --pipeline_config configs/ltxv-13b-0.9.8-distilled.yaml
```

### CLI flags (`InferenceConfig` in `ltx_video/inference.py`)
| Flag | Default | Notes |
|---|---|---|
| `--prompt` | required | < 120 words triggers prompt enhancement (see below) |
| `--negative_prompt` | `worst quality, inconsistent motion, blurry, jittery, distorted` | |
| `--pipeline_config` | broken default | path to a file in `configs/` |
| `--height` / `--width` | 704 / 1216 | padded up to multiple of 32, then cropped back |
| `--num_frames` | 121 | padded to 8N+1, then cropped back |
| `--frame_rate` | 30 | |
| `--seed` | 171198 | |
| `--offload_to_cpu` | False | only takes effect on CUDA GPUs with < 30 GB VRAM |
| `--output_path` | `outputs/<YYYY-MM-DD>` | |
| `--input_media_path` | None | video-to-video source |
| `--conditioning_media_paths` | None | images or videos; requires `--conditioning_start_frames` |
| `--conditioning_start_frames` | None | each in `[0, num_frames-1]` |
| `--conditioning_strengths` | 1.0 each | each in `[0, 1]` |
| `--image_cond_noise_scale` | 0.15 | noise added to conditioning image |

Output: `video_output_<i>_<prompt-slug>_<seed>_<HxWxF>_<n>.mp4` (a `.png` if 1 frame) in the output dir.
The final log line `Output saved to …` gives the path.

### Python API
```python
from ltx_video.inference import infer, InferenceConfig
infer(InferenceConfig(prompt="a red fox in snow", pipeline_config="configs/ltxv-2b-0.9.8-distilled.yaml",
                      height=480, width=704, num_frames=97))
```

## 3. Choosing a config (`configs/`)
| Config | Type | Use |
|---|---|---|
| `ltxv-13b-0.9.8-dev.yaml` | multi-scale | best quality, slowest, most VRAM |
| `ltxv-13b-0.9.8-distilled.yaml` | multi-scale | **recommended default**: fast, near-dev quality |
| `ltxv-2b-0.9.8-distilled.yaml` | multi-scale | low VRAM, fastest iteration |
| `*-fp8.yaml` (13b dev/distilled, 2b distilled) | multi-scale | quantized; Ada+ GPU and FP8 kernels |
| `ltxv-2b-0.9.6-dev.yaml` / `-distilled.yaml` | base | older 2B |
| `ltxv-2b-0.9.yaml`, `0.9.1`, `0.9.5` | base | legacy |

"multi-scale" = generate at `downscale_factor` (≈0.667) then upsample latents with
`ltxv-spatial-upscaler-0.9.8.safetensors` and refine (`first_pass` / `second_pass` blocks).
Distilled configs use guidance_scale 1 and stg_scale 0 (no CFG/STG); dev configs use per-timestep CFG+STG schedules.
To tune sampling, copy a YAML and edit it rather than editing the shipped one.

## 4. Models and downloads
- `checkpoint_path` / `spatial_upscaler_model_path` in the YAML: if not a local file, downloaded via
  `hf_hub_download` from `Lightricks/LTX-Video` into `~/.cache/huggingface` (set `HF_HOME` to relocate).
  Put a local path in the YAML to use pre-downloaded weights.
- Text encoder: `PixArt-alpha/PixArt-XL-2-1024-MS` (T5-XXL, large).
- Prompt enhancement (when prompt word count < `prompt_enhancement_words_threshold`, 120): additionally loads
  `MiaoshouAI/Florence-2-large-PromptGen-v2.0` and `unsloth/Llama-3.2-3B-Instruct`. Set the threshold to `0`
  in a copied YAML, or write a 120+ word prompt, to skip them.
- Budget tens of GB of disk for one 13B config plus encoders.

## 5. Prompting tips (from upstream README)
Long, chronological, single-paragraph descriptions: main action first, then specific movements/gestures,
appearance, background, camera angle/movement, lighting/colors, any sudden changes. Keep under ~200 words.

## 6. Troubleshooting
| Symptom | Cause / fix |
|---|---|
| `Pipeline config file configs/ltxv-13b-0.9.7-dev.yaml does not exist` | pass `--pipeline_config` |
| `conditioning_start_frames must also be provided` | add one start frame per media path |
| `must have the same length` | paths / strengths / start frames lists differ in length |
| `No space left on device` | HF cache filled disk; set `HF_HOME` to a big volume or clear `~/.cache/huggingface` |
| CUDA OOM | use 2B distilled or fp8, lower resolution/frames, `--offload_to_cpu`, avoid prompt enhancer |
| Output size differs from requested | it shouldn't; padding is cropped. Frame count of the conditioning video must be 8N+1 |
| Runs extremely slowly | running on CPU (`get_device()` falls back to cpu if no CUDA/MPS) |

## 7. Tests
```bash
pip install -e ".[inference,test]"
pytest -q tests/test_vae.py tests/test_scheduler.py   # offline, CPU OK: 14 pass (verified 2026-10-05)
pytest -q tests                                        # test_configs/test_inference download full models: GPU + lots of disk
```

## Provenance and maintenance
Verified 2026-10-05 at upstream commit `4b2d053`. Re-verify drift-prone facts:
- Flags: `grep -n "field(" -A2 ltx_video/inference.py`
- Configs: `ls configs; grep -n checkpoint_path configs/*.yaml`
- Broken default still broken: `grep -n 'default="configs' ltx_video/inference.py`
- Deps: `sed -n '/dependencies/,/^$/p' pyproject.toml`
