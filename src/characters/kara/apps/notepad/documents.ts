export interface NotepadArgs {
  text: string;
}

export function notepadTitle(fileName: string): string {
  return `${fileName} - Notepad`;
}

/** What opens when nothing asked for a particular file: the one on the desktop. */
export const ASDF_LETTER = String.raw`asdf asdf

To: Kiri
Re: This computer

Dear Registered Owner,

This is a very formal letter.
Please find the enclosed burger.

      .-""""""-.
    .'  . ' .   '.
   /______________\
   ~~~~~~~~~~~~~~~~
   ################
   \______________/

Sincerely,
Kara

P.S. It was warm when I sent it.`;
