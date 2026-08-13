# Session Presentations — upload folder

Drop your `.ppt` / `.pptx` files in this folder. They appear automatically on
the home page in the **Session Presentations** section (just above the footer),
sorted by filename.

## How to add a presentation

1. Copy your `.pptx` file into this folder (via SCP / SFTP / the NAS file
   manager).
2. Refresh the home page — no rebuild or restart needed. Files are
   discovered from this folder on every page load.
3. Optional: prefix the filename with a number to control the order, e.g.
   `01 Session 1 Orientation.pptx`, `02 Session 2 Works.pptx`.

## Notes

- Keep filenames reasonably short and avoid special characters (`&`, `#`,
  spaces are fine but encode awkwardly) — the filename becomes the visible
  title on the page.
- Files are served as-is from `/ppt/<filename>`. Each presentation is
  embedded lazily (only loads when the visitor scrolls to it) so large files
  never slow down the page.
- Do not delete this `README.md` — it keeps the folder in the repository.
