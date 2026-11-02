export interface RadioTrack {
  videoId: string;
  /** What this computer calls it. The real title is YouTube's to show. */
  label: string;
}

/** To add a song: its id is the part after youtu.be/ in the link. */
export const RADIO_TRACKS: RadioTrack[] = [
  { videoId: "PKQPey6L42M", label: "very serious coconut briefing.mp3" },
  { videoId: "CZlfbep2LdU", label: "definitely_not_a_sheep.mp3" },
  { videoId: "dQw4w9WgXcQ", label: "important_meeting_recording.mp3" },
  { videoId: "ZZ5LpwO-An4", label: "customer_support_hold_music.mp3" },
  { videoId: "ejhcSi4W568", label: "dairy_report_q3.mp3" },
  { videoId: "FoO7Pmx0bE4", label: "do_not_play_at_bedtime.mp3" },
  { videoId: "Xpf5P7X0sNo", label: "frog_driver_install.mp3" },
  { videoId: "dAXa3wTZjes", label: "laundry.mp3" },
  { videoId: "O8HBUcZ5U70", label: "sponsored_by_gravity.mp3" },
  { videoId: "loV3uHuvIpI", label: "tv_static_do_not_adjust.mp3" },
  { videoId: "ns4ZgoA8kOQ", label: "soft_opening_no_refunds.mp3" },
  { videoId: "REHaWSvWkF0", label: "not_a_cover.mp3" },
];

/** A new running order for each time the radio opens. */
export function shuffledTracks(): RadioTrack[] {
  const tracks = [...RADIO_TRACKS];
  for (let i = tracks.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
  }
  return tracks;
}
