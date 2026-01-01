import plexifyChatburger from '../../assets/brand/plexify-chatburger.svg';
import plexifyMarkGray from '../../assets/brand/plexify-mark-gray.png';

export type BrandMarkVariant = 'grayP' | 'chatburger';

type BrandMarkSize = 'sm' | 'md' | 'lg' | number;

const sizePxFor = (size: BrandMarkSize): number => {
  if (typeof size === 'number') return size;
  switch (size) {
    case 'sm':
      return 24;
    case 'lg':
      return 40;
    case 'md':
    default:
      return 32;
  }
};

export default function BrandMark({
  variant = 'grayP',
  size = 'md',
  alt = 'Plexify',
  className,
}: {
  variant?: BrandMarkVariant;
  size?: BrandMarkSize;
  alt?: string;
  className?: string;
}) {
  const px = sizePxFor(size);
  const src = variant === 'chatburger' ? plexifyChatburger : plexifyMarkGray;

  return (
    <img
      src={src}
      alt={alt}
      width={px}
      height={px}
      className={['block object-contain', className].filter(Boolean).join(' ')}
      style={{ width: px, height: px }}
    />
  );
}
