import { XMLParser } from 'fast-xml-parser'
import { array, number, object, parse, pipe, string, transform } from 'valibot'

export interface Episode {
  id: number
  title: string
  published: Date
  description: string
  content: string
  audio: {
    src: string
    type: string
  }
}

export async function getAllEpisodes() {
  let FeedSchema = object({
    rss: object({
      channel: object({
        item: array(
          object({
            id: pipe(number(), transform(Number)),
            title: string(),
            pubDate: string(),
            description: string(),
            'content:encoded': string(),
            enclosure: object({
              '@_url': string(),
              '@_type': string(),
            }),
          }),
        ),
      }),
    }),
  })

  let response = await fetch('https://their-side-feed.vercel.app/api/feed')
  let xml = await response.text()
  let parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
  })
  let feed = parser.parse(xml)
  let items = parse(FeedSchema, feed).rss.channel.item

  let episodes: Array<Episode> = items.map(
    ({ id, title, description, enclosure, pubDate, ...item }) => ({
      id,
      title: `${id}: ${title}`,
      published: new Date(pubDate),
      description,
      content: item['content:encoded'],
      audio: {
        src: enclosure['@_url'],
        type: enclosure['@_type'],
      },
    }),
  )

  return episodes
}
