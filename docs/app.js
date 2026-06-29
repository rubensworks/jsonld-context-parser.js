import {createApp} from 'https://unpkg.com/petite-vue?module';
import {ContextParser} from './bundle.js';

createApp({
  // data
  contextString: JSON.stringify([
    {
      "@vocab": "http://vocab.org/",
      "npmd": "https://linkedsoftwaredependencies.org/bundles/npm/",
      "p": { "@id": "pred1", "@language": "nl" }
    }
  ], null, 2),
  hardenedContext: "",
  filename: "",
  parseError: "",

  async updateHardenedContext() {
    const parser = new ContextParser();
    const {contextRaw} = await parser.parse(JSON.parse(this.contextString));
    this.hardenedContext = JSON.stringify(contextRaw, null, 2);
  },

  // methods
  async pickFile() {
    const [fileHandle] = await window.showOpenFilePicker();
    this.filename = fileHandle.name;
    const file = await fileHandle.getFile();
    const text = await file.text();
    try {
      this.contextString = text;
      this.setHardenedContext(JSON.parse(text));
      this.parseError = "";
    } catch(error) {
      // TODO: error on selected files should be reported somewhere else
      // ...and be blocking...
      this.parseError = error.message;
      console.error(error);
    };
  },
  getContext($event) {
    try {
      this.setHardenedContext(JSON.parse($event.target.value));
      this.parseError = "";
    } catch(error) {
      this.parseError = error.message;
      console.error(error);
    }
  },
  setHardenedContext(context) {
    console.log('Setting hardened context', context);
    this.hardenedContext = JSON.stringify(context, null, 2);
  }
}).mount();