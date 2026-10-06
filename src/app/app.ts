import { Component } from '@angular/core';
import { BooksPage } from './features/books/components/books-page/books-page';

@Component({
  imports: [BooksPage],
  selector: 'app-root',
  templateUrl: './app.html',
})
export class App {}
