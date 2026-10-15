import Image from 'next/image'

export function useMDXComponents(components) {
  return {
    ...components,
    // `alt` is already part of `ImageProps`
    // eslint-disable-next-line jsx-a11y/alt-text
    Image: (props) => <Image {...props} />,
  }
}
