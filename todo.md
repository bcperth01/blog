# Todo

## Future Considerations

### Check image usage before deletion
When deleting an image, warn the user if it is referenced in any posts.
Two places to check:
- `card_image` column — direct DB query: `SELECT title FROM posts WHERE card_image LIKE '%filename%'`
- Post `content` field — best-effort `LIKE` search through markdown content for the image URL

If matches are found, list the affected post titles in the confirm dialog before proceeding.
Note: URL encoding in content fields makes matching tricky and the content search could be slow on large datasets.
