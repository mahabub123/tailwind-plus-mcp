import { revalidateTag } from 'next/cache'

// This is optional, hides the console.log from the <SanityLive /> component
export const revalidateSyncTags = async (tags: string[]) => {
  'use server'
  revalidateTag('sanity:fetch-sync-tags', 'max')
  for (let _tag of tags) {
    revalidateTag(`sanity:${_tag}`, 'max')
    // console.log(`<SanityLive /> revalidated tag: ${tag}`)
  }
}
