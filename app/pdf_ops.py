"""
PDF operations using pikepdf (qpdf wrapper).

Provides merge, delete pages, and extract pages functionality.
"""

import io
import logging
from typing import BinaryIO, List

import pikepdf

from .pagespec import PageSpecError, pages_to_keep

logger = logging.getLogger(__name__)


class PDFError(Exception):
    """Base exception for PDF operation errors."""

    pass


class InvalidPDFError(PDFError):
    """Raised when input file is not a valid PDF."""

    pass


def is_valid_pdf(file_data: bytes) -> bool:
    """
    Check if the file data appears to be a valid PDF.

    PDF files should start with '%PDF-' (magic bytes).
    """
    if len(file_data) < 5:
        return False

    # Check PDF magic bytes
    return file_data[:5] == b"%PDF-"


def open_pdf(source) -> pikepdf.Pdf:
    """
    Open a PDF from a file-like object or path.

    Raises:
        InvalidPDFError: If the file is not a valid PDF
    """
    try:
        # For file-like objects, read and check bytes first
        if hasattr(source, "read"):
            data = source.read(1024)  # Read first 1KB for validation
            source.seek(0)  # Reset position

            if not is_valid_pdf(data):
                raise InvalidPDFError("File is not a valid PDF")

        return pikepdf.open(source)
    except pikepdf.PdfError as e:
        logger.error(f"PikePDF error: {e}")
        raise InvalidPDFError(f"Cannot open PDF: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error opening PDF: {e}")
        raise InvalidPDFError(f"Error opening PDF: {str(e)}")


def merge_pdfs(files: List[BinaryIO], output_filename: str = "merged.pdf") -> bytes:
    """
    Merge multiple PDFs into a single PDF.

    Args:
        files: List of file-like objects containing PDF data
        output_filename: Filename to use in the output

    Returns:
        Merged PDF as bytes

    Raises:
        PDFError: If merge operation fails
    """
    if not files:
        raise PDFError("No files provided for merging")

    merged_pdf = pikepdf.Pdf.new()

    for i, file_obj in enumerate(files):
        try:
            file_obj.seek(0)
            source_pdf = open_pdf(file_obj)

            # Copy all pages from source to merged PDF
            for page in source_pdf.pages:
                merged_pdf.pages.append(page)

            logger.info(f"Added PDF {i + 1} with {len(source_pdf.pages)} pages")
            source_pdf.close()

        except InvalidPDFError as e:
            raise PDFError(f"File {i + 1}: {str(e)}")
        except Exception as e:
            logger.error(f"Error processing file {i + 1}: {e}")
            raise PDFError(f"Error processing file {i + 1}: {str(e)}")

    # Save to bytes
    output = io.BytesIO()
    try:
        merged_pdf.save(output)
        logger.info(f"Successfully merged {len(files)} PDFs")
    except Exception as e:
        logger.error(f"Error saving merged PDF: {e}")
        raise PDFError(f"Error saving merged PDF: {str(e)}")
    finally:
        merged_pdf.close()

    return output.getvalue()


def delete_pages(
    file: BinaryIO, pages_spec: str, output_filename: str = "modified.pdf"
) -> bytes:
    """
    Delete specified pages from a PDF.

    Args:
        file: File-like object containing PDF data
        pages_spec: Page specification (e.g., "1,3-5,7")
        output_filename: Filename to use in the output

    Returns:
        Modified PDF as bytes

    Raises:
        PDFError: If operation fails
        PageSpecError: If page specification is invalid
    """
    try:
        file.seek(0)
        source_pdf = open_pdf(file)
        total_pages = len(source_pdf.pages)

        # Get pages to keep (inverse of delete)
        keep_pages = pages_to_keep(pages_spec, total_pages, mode="delete")

        # Create new PDF with only the pages we want to keep
        output_pdf = pikepdf.Pdf.new()
        for page_num in keep_pages:
            # pikepdf uses 0-based indexing internally
            output_pdf.pages.append(source_pdf.pages[page_num - 1])

        output = io.BytesIO()
        output_pdf.save(output)

        source_pdf.close()
        output_pdf.close()

        logger.info(f"Deleted pages from PDF: kept {len(keep_pages)}/{total_pages} pages")
        return output.getvalue()

    except PageSpecError:
        raise
    except InvalidPDFError as e:
        raise PDFError(str(e))
    except Exception as e:
        logger.error(f"Error deleting pages: {e}")
        raise PDFError(f"Error deleting pages: {str(e)}")


def extract_pages(
    file: BinaryIO, pages_spec: str, output_filename: str = "extracted.pdf"
) -> bytes:
    """
    Extract specified pages from a PDF into a new PDF.

    Args:
        file: File-like object containing PDF data
        pages_spec: Page specification (e.g., "1,3-5,7")
        output_filename: Filename to use in the output

    Returns:
        New PDF containing extracted pages as bytes

    Raises:
        PDFError: If operation fails
        PageSpecError: If page specification is invalid
    """
    try:
        file.seek(0)
        source_pdf = open_pdf(file)
        total_pages = len(source_pdf.pages)

        # Get pages to extract
        extract_pages_list = pages_to_keep(pages_spec, total_pages, mode="extract")

        # Create new PDF with extracted pages
        output_pdf = pikepdf.Pdf.new()
        for page_num in extract_pages_list:
            # pikepdf uses 0-based indexing internally
            output_pdf.pages.append(source_pdf.pages[page_num - 1])

        output = io.BytesIO()
        output_pdf.save(output)

        source_pdf.close()
        output_pdf.close()

        logger.info(
            f"Extracted pages from PDF: {len(extract_pages_list)}/{total_pages} pages"
        )
        return output.getvalue()

    except PageSpecError:
        raise
    except InvalidPDFError as e:
        raise PDFError(str(e))
    except Exception as e:
        logger.error(f"Error extracting pages: {e}")
        raise PDFError(f"Error extracting pages: {str(e)}")


def sanitize_filename(filename: str) -> str:
    """
    Sanitize a filename by removing potentially dangerous characters.

    Keeps alphanumeric, hyphens, underscores, dots, and spaces.
    """
    import re

    # Remove path components
    filename = filename.split("\\")[-1].split("/")[-1]

    # Replace non-safe characters with underscore
    filename = re.sub(r'[^\w\s\-\.]', '_', filename)

    # Remove leading/trailing dots and spaces
    filename = filename.strip('. ')

    # Ensure filename is not empty
    if not filename:
        filename = "document.pdf"

    # Ensure it ends with .pdf
    if not filename.lower().endswith('.pdf'):
        filename += '.pdf'

    return filename
