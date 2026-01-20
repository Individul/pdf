"""
Pages specification parser and validator.

Accepts formats like:
- "1,3,5" - individual pages
- "1-5" - ranges
- "1,3-5,7" - mixed
- " 1 , 3 - 5 " - with spaces

Returns sorted list of unique 1-based page numbers.
"""


class PageSpecError(Exception):
    """Raised when page specification is invalid."""

    pass


def parse_pagespec(spec: str, total_pages: int) -> list[int]:
    """
    Parse a pages specification string and return a list of 1-based page numbers.

    Args:
        spec: Page specification string (e.g., "1,3-5,7")
        total_pages: Total number of pages in the PDF for validation

    Returns:
        Sorted list of unique 1-based page numbers

    Raises:
        PageSpecError: If specification is invalid or refers to non-existent pages
    """
    if not spec or not spec.strip():
        raise PageSpecError("Page specification cannot be empty")

    spec = spec.strip()
    pages = set()

    # Split by comma first
    parts = spec.split(",")
    for part in parts:
        part = part.strip()
        if not part:
            continue

        # Check if it's a range
        if "-" in part:
            range_parts = part.split("-")
            if len(range_parts) != 2:
                raise PageSpecError(f"Invalid range format: '{part}'")

            try:
                start_str = range_parts[0].strip()
                end_str = range_parts[1].strip()

                if not start_str or not end_str:
                    raise PageSpecError(f"Invalid range format: '{part}'")

                start = int(start_str)
                end = int(end_str)
            except ValueError:
                raise PageSpecError(f"Invalid numbers in range: '{part}'")

            if start <= 0 or end <= 0:
                raise PageSpecError(f"Page numbers must be positive (found in '{part}')")

            if start > end:
                raise PageSpecError(
                    f"Range start cannot be greater than end: {start}-{end}"
                )

            # Add all pages in the range
            for page in range(start, end + 1):
                if page > total_pages:
                    raise PageSpecError(
                        f"Page {page} exceeds total pages ({total_pages})"
                    )
                pages.add(page)
        else:
            # Single page
            try:
                page = int(part)
            except ValueError:
                raise PageSpecError(f"Invalid page number: '{part}'")

            if page <= 0:
                raise PageSpecError(f"Page number must be positive: {page}")

            if page > total_pages:
                raise PageSpecError(
                    f"Page {page} exceeds total pages ({total_pages})"
                )

            pages.add(page)

    if not pages:
        raise PageSpecError("No valid pages found in specification")

    return sorted(pages)


def pages_to_keep(spec: str, total_pages: int, mode: str) -> list[int]:
    """
    Determine which pages to keep based on the operation mode.

    Args:
        spec: Page specification string
        total_pages: Total number of pages in the PDF
        mode: Either "extract" or "delete"

    Returns:
        List of 1-based page numbers to keep

    Raises:
        PageSpecError: If specification is invalid
    """
    specified_pages = parse_pagespec(spec, total_pages)

    if mode == "extract":
        # For extract, keep only the specified pages in order
        return specified_pages
    elif mode == "delete":
        # For delete, keep all pages EXCEPT the specified ones
        all_pages = set(range(1, total_pages + 1))
        specified_set = set(specified_pages)
        keep_pages = all_pages - specified_set

        if not keep_pages:
            raise PageSpecError("Cannot delete all pages from PDF")

        return sorted(keep_pages)
    else:
        raise ValueError(f"Invalid mode: {mode}")
