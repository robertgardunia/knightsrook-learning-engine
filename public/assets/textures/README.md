# textures/

Shared textures **not** baked into a room or avatar GLB — e.g. a shared
skybox/environment map reused across multiple rooms, or a shared UI texture
atlas. Most textures should stay baked into their GLB; only promote a texture
here if it is genuinely reused across more than one asset.

```
textures/
  environment/
    starfield.hdr
```

Nothing checked in yet.
