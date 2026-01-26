import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { PlexifyTheme } from '../types';

export interface PDFExportOptions {
  title?: string;
  subtitle?: string;
  author?: string;
  date?: string;
  theme?: PlexifyTheme;
  includeHeader?: boolean;
  includeFooter?: boolean;
  pageNumbers?: boolean;
  margins?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

export async function exportReportToPDF(
  content: string | HTMLElement,
  filename: string = 'report.pdf',
  options: PDFExportOptions = {}
): Promise<void> {
  const {
    title = 'Report',
    subtitle,
    author,
    date = new Date().toLocaleDateString(),
    theme,
    includeHeader = true,
    includeFooter = true,
    pageNumbers = true,
    margins = { top: 20, right: 20, bottom: 20, left: 20 },
  } = options;

  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margins.left - margins.right;

  // Set primary color from theme or default
  const primaryColor = theme?.primaryColor || '#1e3a8a';
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 30, g: 58, b: 138 };
  };
  const rgb = hexToRgb(primaryColor);

  // Add header
  if (includeHeader) {
    pdf.setFillColor(rgb.r, rgb.g, rgb.b);
    pdf.rect(0, 0, pageWidth, 30, 'F');

    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.text(title, margins.left, 18);

    if (subtitle) {
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(subtitle, margins.left, 25);
    }

    // Add date on the right
    pdf.setFontSize(10);
    pdf.text(date, pageWidth - margins.right, 18, { align: 'right' });
  }

  // Content start position
  let yPosition = includeHeader ? 40 : margins.top;

  // If content is HTML string, create a temporary element
  let contentElement: HTMLElement;
  let shouldRemoveElement = false;

  if (typeof content === 'string') {
    contentElement = document.createElement('div');
    contentElement.innerHTML = content;
    contentElement.style.width = `${contentWidth * 3.78}px`; // Convert mm to px (roughly)
    contentElement.style.padding = '20px';
    contentElement.style.fontFamily = 'Arial, sans-serif';
    contentElement.style.fontSize = '12px';
    contentElement.style.lineHeight = '1.6';
    contentElement.style.color = '#111827';
    contentElement.style.position = 'absolute';
    contentElement.style.left = '-9999px';
    document.body.appendChild(contentElement);
    shouldRemoveElement = true;
  } else {
    contentElement = content;
  }

  try {
    // Convert HTML to canvas
    const canvas = await html2canvas(contentElement, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    // Calculate dimensions
    const imgWidth = contentWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    // Add image to PDF (may span multiple pages)
    const availableHeight = pageHeight - yPosition - margins.bottom;

    if (imgHeight <= availableHeight) {
      // Fits on one page
      pdf.addImage(
        canvas.toDataURL('image/png'),
        'PNG',
        margins.left,
        yPosition,
        imgWidth,
        imgHeight
      );
    } else {
      // Split across multiple pages
      let remainingHeight = imgHeight;
      let sourceY = 0;
      let pageNum = 1;

      while (remainingHeight > 0) {
        const availHeight = pageNum === 1 ? availableHeight : pageHeight - margins.top - margins.bottom;
        const chunkHeight = Math.min(remainingHeight, availHeight);
        const sourceHeight = (chunkHeight * canvas.height) / imgHeight;

        // Create a chunk canvas
        const chunkCanvas = document.createElement('canvas');
        chunkCanvas.width = canvas.width;
        chunkCanvas.height = sourceHeight;
        const chunkCtx = chunkCanvas.getContext('2d');

        if (chunkCtx) {
          chunkCtx.drawImage(
            canvas,
            0,
            sourceY,
            canvas.width,
            sourceHeight,
            0,
            0,
            canvas.width,
            sourceHeight
          );

          const yPos = pageNum === 1 ? yPosition : margins.top;
          pdf.addImage(
            chunkCanvas.toDataURL('image/png'),
            'PNG',
            margins.left,
            yPos,
            imgWidth,
            chunkHeight
          );
        }

        remainingHeight -= chunkHeight;
        sourceY += sourceHeight;

        if (remainingHeight > 0) {
          pdf.addPage();
          pageNum++;
        }
      }

      // Add page numbers if enabled
      if (pageNumbers) {
        const totalPages = pdf.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
          pdf.setPage(i);
          pdf.setTextColor(128, 128, 128);
          pdf.setFontSize(10);
          pdf.text(
            `Page ${i} of ${totalPages}`,
            pageWidth / 2,
            pageHeight - 10,
            { align: 'center' }
          );
        }
      }
    }

    // Add footer
    if (includeFooter) {
      const totalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setDrawColor(rgb.r, rgb.g, rgb.b);
        pdf.setLineWidth(0.5);
        pdf.line(margins.left, pageHeight - 15, pageWidth - margins.right, pageHeight - 15);

        if (author) {
          pdf.setTextColor(128, 128, 128);
          pdf.setFontSize(8);
          pdf.text(`Generated by ${author}`, margins.left, pageHeight - 8);
        }
      }
    }

    // Save the PDF
    pdf.save(filename);
  } finally {
    // Clean up temporary element
    if (shouldRemoveElement && contentElement.parentNode) {
      contentElement.parentNode.removeChild(contentElement);
    }
  }
}

export async function exportElementToPDF(
  elementId: string,
  filename: string = 'report.pdf',
  options: PDFExportOptions = {}
): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Element with id "${elementId}" not found`);
  }
  return exportReportToPDF(element, filename, options);
}
