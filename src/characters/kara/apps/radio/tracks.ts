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
