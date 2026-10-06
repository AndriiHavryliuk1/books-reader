import { DOCUMENT, inject, Injectable } from '@angular/core';
import { defer, finalize, map, Observable, timer } from 'rxjs';

// The download starts after click() returns, so revoking the URL immediately can cancel it.
const REVOKE_URL_DELAY_MS = 100;

@Injectable({
  providedIn: 'root',
})
export class FileService {
  private readonly document = inject(DOCUMENT);

  readText(file: Blob): Observable<string> {
    return defer(() => file.text());
  }

  download(content: string, fileName: string, type: string): Observable<void> {
    return defer(() => {
      const url = URL.createObjectURL(new Blob([content], { type }));
      const link = this.document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      return timer(REVOKE_URL_DELAY_MS).pipe(
        map(() => undefined),
        finalize(() => URL.revokeObjectURL(url)),
      );
    });
  }
}
