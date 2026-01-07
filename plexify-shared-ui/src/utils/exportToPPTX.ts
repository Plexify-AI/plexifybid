import pptxgen from 'pptxgenjs';
import { PlexifyTheme } from '../types';

export interface PPTXExportOptions {
  title?: string;
  subtitle?: string;
  author?: string;
  company?: string;
  theme?: PlexifyTheme;
  includeTableOfContents?: boolean;
}

interface ContentSection {
  title: string;
  content: string;
  type?: 'heading' | 'paragraph' | 'list' | 'quote';
}

function parseHTMLToSections(htmlContent: string): ContentSection[] {
  const sections: ContentSection[] = [];

  // Create a temporary element to parse HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlContent;

  const children = tempDiv.children;
  let currentSection: ContentSection | null = null;

  for (let i = 0; i < children.length; i++) {
    const element = children[i];
    const tagName = element.tagName.toLowerCase();
    const textContent = element.textContent?.trim() || '';

    if (['h1', 'h2', 'h3'].includes(tagName)) {
      // Save previous section if exists
      if (currentSection) {
        sections.push(currentSection);
      }
      // Start new section with heading
      currentSection = {
        title: textContent,
        content: '',
        type: 'heading',
      };
    } else if (currentSection) {
      // Add content to current section
      if (tagName === 'ul' || tagName === 'ol') {
        const items = element.querySelectorAll('li');
        const listItems = Array.from(items)
          .map((li) => `• ${li.textContent?.trim()}`)
          .join('\n');
        currentSection.content += (currentSection.content ? '\n\n' : '') + listItems;
        currentSection.type = 'list';
      } else if (tagName === 'blockquote') {
        currentSection.content += (currentSection.content ? '\n\n' : '') + `"${textContent}"`;
        currentSection.type = 'quote';
      } else if (textContent) {
        currentSection.content += (currentSection.content ? '\n\n' : '') + textContent;
        currentSection.type = 'paragraph';
      }
    } else if (textContent) {
      // No current section, create one without title
      sections.push({
        title: '',
        content: textContent,
        type: 'paragraph',
      });
    }
  }

  // Add last section
  if (currentSection) {
    sections.push(currentSection);
  }

  return sections;
}

export async function exportReportToPPTX(
  content: string,
  projectName: string,
  options: PPTXExportOptions = {}
): Promise<void> {
  const {
    title = projectName,
    subtitle,
    author = 'Plexify AI',
    company = 'Plexify',
    theme,
    includeTableOfContents = true,
  } = options;

  const pptx = new pptxgen();

  // Set presentation properties
  pptx.author = author;
  pptx.company = company;
  pptx.subject = title;
  pptx.title = title;

  // Get theme colors
  const primaryColor = theme?.primaryColor?.replace('#', '') || '1e3a8a';
  const secondaryColor = theme?.secondaryColor?.replace('#', '') || '3b82f6';
  const textColor = theme?.textPrimary?.replace('#', '') || '111827';
  const textInverse = theme?.textInverse?.replace('#', '') || 'FFFFFF';

  // Define master slide
  pptx.defineSlideMaster({
    title: 'PLEXIFY_MASTER',
    background: { color: 'FFFFFF' },
    objects: [
      // Header bar
      {
        rect: {
          x: 0,
          y: 0,
          w: '100%',
          h: 0.5,
          fill: { color: primaryColor },
        },
      },
      // Footer bar
      {
        rect: {
          x: 0,
          y: 5.25,
          w: '100%',
          h: 0.25,
          fill: { color: primaryColor },
        },
      },
    ],
    slideNumber: {
      x: 9.0,
      y: 5.0,
      w: 0.5,
      h: 0.25,
      fontSize: 10,
      color: '808080',
    },
  });

  // Title slide
  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: primaryColor };

  titleSlide.addText(title, {
    x: 0.5,
    y: 2.0,
    w: 9.0,
    h: 1.0,
    fontSize: 44,
    color: textInverse,
    bold: true,
    align: 'center',
  });

  if (subtitle) {
    titleSlide.addText(subtitle, {
      x: 0.5,
      y: 3.2,
      w: 9.0,
      h: 0.5,
      fontSize: 20,
      color: textInverse,
      align: 'center',
    });
  }

  titleSlide.addText(new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }), {
    x: 0.5,
    y: 4.5,
    w: 9.0,
    h: 0.3,
    fontSize: 14,
    color: textInverse,
    align: 'center',
  });

  // Parse content into sections
  const sections = parseHTMLToSections(content);

  // Table of contents slide (if enabled and there are sections with titles)
  const titledSections = sections.filter((s) => s.title);
  if (includeTableOfContents && titledSections.length > 1) {
    const tocSlide = pptx.addSlide({ masterName: 'PLEXIFY_MASTER' });

    tocSlide.addText('Table of Contents', {
      x: 0.5,
      y: 0.7,
      w: 9.0,
      h: 0.6,
      fontSize: 28,
      color: primaryColor,
      bold: true,
    });

    const tocItems = titledSections.map((section, index) => ({
      text: `${index + 1}. ${section.title}`,
      options: {
        fontSize: 16,
        color: textColor,
        bullet: false,
        paraSpaceAfter: 10,
      },
    }));

    tocSlide.addText(tocItems, {
      x: 0.5,
      y: 1.5,
      w: 9.0,
      h: 3.5,
    });
  }

  // Content slides
  for (const section of sections) {
    const slide = pptx.addSlide({ masterName: 'PLEXIFY_MASTER' });

    if (section.title) {
      slide.addText(section.title, {
        x: 0.5,
        y: 0.7,
        w: 9.0,
        h: 0.6,
        fontSize: 24,
        color: primaryColor,
        bold: true,
      });
    }

    if (section.content) {
      const contentY = section.title ? 1.5 : 0.7;
      const contentH = section.title ? 3.5 : 4.3;

      if (section.type === 'list') {
        // Parse bullet points
        const items = section.content.split('\n').filter((line) => line.trim());
        const bulletItems = items.map((item) => ({
          text: item.replace(/^[•\-]\s*/, ''),
          options: {
            fontSize: 16,
            color: textColor,
            bullet: { type: 'bullet' as const },
            paraSpaceAfter: 8,
          },
        }));

        slide.addText(bulletItems, {
          x: 0.5,
          y: contentY,
          w: 9.0,
          h: contentH,
        });
      } else if (section.type === 'quote') {
        // Quote style
        slide.addShape('rect', {
          x: 0.4,
          y: contentY,
          w: 0.1,
          h: contentH - 0.5,
          fill: { color: secondaryColor },
        });

        slide.addText(section.content, {
          x: 0.7,
          y: contentY,
          w: 8.8,
          h: contentH,
          fontSize: 18,
          color: textColor,
          italic: true,
        });
      } else {
        // Regular paragraph
        slide.addText(section.content, {
          x: 0.5,
          y: contentY,
          w: 9.0,
          h: contentH,
          fontSize: 16,
          color: textColor,
          valign: 'top',
        });
      }
    }
  }

  // Thank you slide
  const endSlide = pptx.addSlide();
  endSlide.background = { color: primaryColor };

  endSlide.addText('Thank You', {
    x: 0.5,
    y: 2.0,
    w: 9.0,
    h: 1.0,
    fontSize: 44,
    color: textInverse,
    bold: true,
    align: 'center',
  });

  endSlide.addText(`Generated by ${company}`, {
    x: 0.5,
    y: 3.5,
    w: 9.0,
    h: 0.5,
    fontSize: 14,
    color: textInverse,
    align: 'center',
  });

  // Save the file
  const filename = `${projectName.replace(/[^a-z0-9]/gi, '_')}_report.pptx`;
  await pptx.writeFile({ fileName: filename });
}
