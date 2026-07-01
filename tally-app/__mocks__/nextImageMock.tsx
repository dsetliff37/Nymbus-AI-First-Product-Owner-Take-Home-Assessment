// Mock for next/image in tests
import React from 'react';

type ImageProps = {
  src: string;
  alt: string;
  [key: string]: unknown;
};

const NextImage = ({ src, alt, ...props }: ImageProps) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img src={src} alt={alt} {...props} />
);

export default NextImage;
