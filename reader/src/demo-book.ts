import type { BookManifest } from './types'

export const DEMO_MANIFEST: BookManifest = {
  id: 'demo',
  title: 'The Time Machine',
  author: 'H.G. Wells',
  emoji: '⏱',
  chapters: [
    {
      title: 'Chapter I — Introduction',
      scenes: [
        {
          id: 'demo-1-1',
          mood: 'curious',
          visualPrompt: 'Victorian laboratory cluttered with brass instruments and glowing dials',
          entities: ['Time Traveller', 'Filby', 'Weena'],
          text: `The Time Traveller (for so it will be convenient to speak of him) was expounding a recondite matter to us. His grey eyes shone and twinkled, and his usually pale face was flushed and animated. The fire burned brightly, and the soft radiance of the incandescent lights in the lilies of silver caught the bubbles that flashed and passed in our glasses.

Our chairs, being his patents, embraced and caressed us rather than submitted to be sat upon, and there was that luxurious after-dinner atmosphere when thought roams gracefully free of the trammels of precision.

"You must follow me carefully. I shall have to controvert one or two ideas that are almost universally accepted. The geometry, for instance, they taught you at school is founded on a misconception."

"Is not that rather a large thing to expect us to begin upon?" said Filby, an argumentative person with red hair.`
        },
        {
          id: 'demo-1-2',
          mood: 'wonder',
          visualPrompt: 'Spinning brass and crystal time machine dissolving into blurred light',
          entities: ['Time Traveller', 'Machine', 'Laboratory'],
          text: `"Clearly," the Time Traveller proceeded, "any real body must have extension in four directions: it must have Length, Breadth, Thickness, and — Duration. But through a natural infirmity of the flesh, which I will explain to you in a moment, we incline to overlook this fact. There are really four dimensions, three which we call the three planes of Space, and a fourth, Time."

He took one of the small octagonal tables that were scattered about the room, and set it in front of the fire, with two legs on the hearthrug. On this table he placed the mechanism. It was a glittering metallic framework, scarcely larger than a small clock, and very delicately made. There was ivory in it, and some transparent crystalline substance.

The thing the Time Traveller held in his hands was a glittering metallic framework, scarcely larger than a small clock, and very delicately made. There was ivory in it, and some transparent crystalline substance. And now I must be explicit, for this that follows — unless his explanation is to be accepted — is an absolutely unaccountable thing.`
        }
      ]
    },
    {
      title: 'Chapter IV — Time Travelling',
      scenes: [
        {
          id: 'demo-4-1',
          mood: 'ominous',
          visualPrompt: 'Vast green landscape under a dying red sun, crumbling stone ruins',
          entities: ['Eloi', 'Morlocks', 'Palace of Green Porcelain'],
          text: `I am afraid I cannot convey the peculiar sensations of time travelling. They are excessively unpleasant. There is a feeling exactly like that one has upon a switchback — of a helpless headlong motion! I felt the same horrible anticipation, too, of an imminent smash. As I put on pace, night followed day like the flapping of a black wing. The dim suggestion of the laboratory seemed presently to fall away from me, and I saw the sun hopping swiftly across the sky, leaping it every minute, and every minute marking a day.

I suppose the next thing was the slowness of my sensations. I seemed to be hurrying onward upon a sort of switchback railway, and the night and day were but a flicker of light and darkness. Then, in the intermittent darknesses, I saw the moon spinning swiftly through her quarters from new to full, and had a faint glimpse of the circling stars.

Presently, as I went on, still gaining velocity, the palpitation of night and day merged into one continuous greyness; the sky took on a wonderful deepness of blue, a splendid luminous colour like that of early twilight; the jerking sun became a streak of fire, a brilliant arch, in space; the moon a fainter fluctuating band; and I could see nothing of the stars, save now and then a brighter circle flickering in the blue.`
        }
      ]
    }
  ]
}
