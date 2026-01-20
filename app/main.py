"""
FastAPI application for PDF Toolbox.

Provides endpoints for merging, deleting pages, and extracting pages from PDFs.
"""

import logging
import os
import tempfile
from contextlib import asynccontextmanager
from typing import List

from fastapi import FastAPI, File, Form, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from fastapi.staticfiles import StaticFiles

from .pagespec import PageSpecError
from .pdf_ops import InvalidPDFError, PDFError, merge_pdfs, sanitize_filename

# Configuration
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100 MB
MAX_MERGE_FILES = 20
REQUEST_TIMEOUT = 300  # 5 minutes

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown events."""
    logger.info("PDF Toolbox starting up...")
    yield
    logger.info("PDF Toolbox shutting down...")


app = FastAPI(
    title="PDF Toolbox",
    description="Merge, delete pages, and extract pages from PDFs",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS - enable for all origins in production if needed, or restrict to your domain
# For same-origin deployment, CORS is not strictly needed
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with your domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Rate limiting - simple in-memory tracker
# For production with multiple workers, use Redis or similar
from collections import defaultdict
from time import time

rate_tracker = defaultdict(list)
RATE_LIMIT = 30  # requests per hour per IP
RATE_WINDOW = 3600  # 1 hour in seconds


def check_rate_limit(client_ip: str) -> bool:
    """Simple rate limiting check."""
    now = time()
    # Clean old entries
    rate_tracker[client_ip] = [
        t for t in rate_tracker[client_ip] if now - t < RATE_WINDOW
    ]

    if len(rate_tracker[client_ip]) >= RATE_LIMIT:
        return False

    rate_tracker[client_ip].append(now)
    return True


def get_client_ip(request) -> str:
    """Get client IP from request, handling proxy headers."""
    # Check for forwarded headers
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()

    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip

    return request.client.host if request.client else "unknown"


async def validate_upload_file(file: UploadFile) -> bytes:
    """
    Validate and read an uploaded file.

    Returns:
        File content as bytes

    Raises:
        HTTPException: If file is invalid
    """
    # Check file size
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)} MB",
        )

    if len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty",
        )

    # Check MIME type (but don't trust it solely)
    if file.content_type and file.content_type != "application/pdf":
        logger.warning(f"File {file.filename} has non-PDF MIME type: {file.content_type}")

    # Check magic bytes
    if len(content) < 5 or content[:5] != b"%PDF-":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File is not a valid PDF (missing PDF header)",
        )

    return content


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "pdf-toolbox"}


@app.post("/api/merge")
async def merge_pdfs_endpoint(files: List[UploadFile] = File(...)):
    """
    Merge multiple PDF files into one.

    - Accepts up to 20 PDF files
    - Returns the merged PDF as a downloadable file
    """
    try:
        # Note: Rate limiting is disabled for MVP
        # To enable, use Request object from FastAPI to get client IP
        # if not check_rate_limit(client_ip):
        #     raise HTTPException(
        #         status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        #         detail="Rate limit exceeded. Please try again later.",
        #     )

        # Validate file count
        if not files or len(files) < 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least 2 PDF files are required for merging",
            )

        if len(files) > MAX_MERGE_FILES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Maximum {MAX_MERGE_FILES} files allowed for merging",
            )

        # Use temporary directory for processing
        with tempfile.TemporaryDirectory() as temp_dir:
            logger.info(f"Processing merge request with {len(files)} files in {temp_dir}")

            # Read and validate all files first
            file_contents = []
            original_filenames = []

            for file in files:
                if not file.filename:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="All files must have a filename",
                    )

                content = await validate_upload_file(file)
                file_contents.append(content)
                original_filenames.append(file.filename)

            # Write to temp files for pikepdf
            temp_files = []
            try:
                for i, content in enumerate(file_contents):
                    temp_path = os.path.join(temp_dir, f"input_{i}.pdf")
                    with open(temp_path, "wb") as f:
                        f.write(content)
                    temp_files.append(open(temp_path, "rb"))

                # Perform merge
                result_bytes = merge_pdfs(temp_files)

                # Generate output filename from first input
                base_name = sanitize_filename(original_filenames[0])
                output_filename = base_name.replace(".pdf", "-merged.pdf")

                # Clean up temp file handles
                for tf in temp_files:
                    tf.close()

                # Return streaming response
                return StreamingResponse(
                    iter([result_bytes]),
                    media_type="application/pdf",
                    headers={
                        "Content-Disposition": f'attachment; filename="{output_filename}"',
                        "Content-Length": str(len(result_bytes)),
                    },
                )

            except PDFError as e:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=str(e),
                )
            except Exception as e:
                logger.error(f"Unexpected error during merge: {e}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="An error occurred while merging PDFs",
                )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in merge endpoint: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred",
        )


@app.post("/api/delete-pages")
async def delete_pages_endpoint(
    file: UploadFile = File(...),
    pages_spec: str = Form(...),
):
    """
    Delete specified pages from a PDF.

    - pages_spec: Page specification like "1,3,5-7"
    - Returns the modified PDF as a downloadable file
    """
    try:
        # Validate file
        if not file.filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File must have a filename",
            )

        content = await validate_upload_file(file)

        # Use temporary directory for processing
        with tempfile.TemporaryDirectory() as temp_dir:
            logger.info(f"Processing delete-pages request in {temp_dir}")

            # Write to temp file
            temp_path = os.path.join(temp_dir, "input.pdf")
            with open(temp_path, "wb") as f:
                f.write(content)

            try:
                # Perform page deletion
                with open(temp_path, "rb") as input_file:
                    from .pdf_ops import delete_pages

                    result_bytes = delete_pages(input_file, pages_spec)

                # Generate output filename
                base_name = sanitize_filename(file.filename)
                output_filename = base_name.replace(".pdf", "-pages-deleted.pdf")

                # Return streaming response
                return StreamingResponse(
                    iter([result_bytes]),
                    media_type="application/pdf",
                    headers={
                        "Content-Disposition": f'attachment; filename="{output_filename}"',
                        "Content-Length": str(len(result_bytes)),
                    },
                )

            except PageSpecError as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=str(e),
                )
            except PDFError as e:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=str(e),
                )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in delete-pages endpoint: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred",
        )


@app.post("/api/extract-pages")
async def extract_pages_endpoint(
    file: UploadFile = File(...),
    pages_spec: str = Form(...),
):
    """
    Extract specified pages from a PDF into a new PDF.

    - pages_spec: Page specification like "1,3,5-7"
    - Returns a new PDF containing only the specified pages
    """
    try:
        # Validate file
        if not file.filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File must have a filename",
            )

        content = await validate_upload_file(file)

        # Use temporary directory for processing
        with tempfile.TemporaryDirectory() as temp_dir:
            logger.info(f"Processing extract-pages request in {temp_dir}")

            # Write to temp file
            temp_path = os.path.join(temp_dir, "input.pdf")
            with open(temp_path, "wb") as f:
                f.write(content)

            try:
                # Perform page extraction
                with open(temp_path, "rb") as input_file:
                    from .pdf_ops import extract_pages

                    result_bytes = extract_pages(input_file, pages_spec)

                # Generate output filename
                base_name = sanitize_filename(file.filename)
                output_filename = base_name.replace(".pdf", "-extracted.pdf")

                # Return streaming response
                return StreamingResponse(
                    iter([result_bytes]),
                    media_type="application/pdf",
                    headers={
                        "Content-Disposition": f'attachment; filename="{output_filename}"',
                        "Content-Length": str(len(result_bytes)),
                    },
                )

            except PageSpecError as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=str(e),
                )
            except PDFError as e:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=str(e),
                )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in extract-pages endpoint: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred",
        )


# Mount static files for the frontend
app.mount("/", StaticFiles(directory="web", html=True), name="frontend")
