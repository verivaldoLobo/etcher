/*
 * Copyright 2018 resin.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict'

const EventEmitter = require('events')
const debug = require('debug')('etcher:writer')
const Pipage = require('pipage')
const ProgressStream = require('./progress-stream')
const Image = require('../image')

/* eslint-disable prefer-reflect */
/* eslint-disable callback-return */

/**
 * @summary Timeout, in milliseconds, to wait before unmounting on success
 * @constant
 * @type {Number}
 */
const UNMOUNT_ON_SUCCESS_TIMEOUT_MS = 2000

/**
 * @summary Helper function to run a set of async tasks in sequence
 * @private
 * @param {Array<Function>} tasks - set of tasks
 * @param {Function} callback - callback(error)
 * @example
 * runSeries([
 *   (next) => first(next),
 *   (next) => second(next),
 * ], (error) => {
 *   // ...
 * })
 */
const runSeries = (tasks, callback) => {
  /**
   * @summary Task runner
   * @param {Error} [error] - error
   * @example
   * run()
   */
  const run = (error) => {
    const task = tasks.shift()
    if (error || task == null) {
      callback(error)
      return
    }
    task(run)
  }

  run()
}

/**
 * @summary Helper function to run a set of async tasks in sequence
 * @private
 * @param {Array<Function>} tasks - set of tasks
 * @param {Function} callback - callback(error)
 * @example
 * runParallel([
 *   (next) => first(next),
 *   (next) => second(next),
 * ], (error) => {
 *   // ...
 * })
 */
const runParallel = (tasks, callback) => {
  let count = tasks.length
  const resultErrors = new Array(count).fill(null)
  const results = new Array(count).fill(null)

  tasks.forEach((task, index) => {
    task((error, result) => {
      count -= 1
      resultErrors[index] = error
      results[index] = result
      if (count === 0) {
        callback(resultErrors, results)
      }
    })
  })
}

class ImageWriter extends EventEmitter {
  /**
   * @summary ImageWriter constructor
   * @param {Object} options - options
   * @param {Boolean} options.verify - whether to verify the dest
   * @param {Boolean} options.unmountOnSuccess - whether to unmount the dest after flashing
   * @param {Array<String>} options.checksumAlgorithms - checksums to calculate
   * @example
   * new ImageWriter(options)
   */
  constructor (options) {
    options = options || {}
    super()

    debug('new', options)

    this.unmountOnSuccess = Boolean(options.unmountOnSuccess)
    this.verifyChecksums = Boolean(options.verify)
    this.checksumAlgorithms = options.checksumAlgorithms || []

    this.finished = false
    this.hadError = false

    this.state = {
      active: 0,
      flashing: 0,
      verifying: 0,
      failed: 0,
      succeeded: 0,
      totalSpeed: 0,
      speed: 0,
      eta: 0,
      bytesRead: 0,
      bytesWritter: 0,
    }

    this.once('error', () => {
      this.hadError = true
    })
  }

  _onProgress() {
    // ...
  }

  /**
   * @summary Start the flashing process
   * @param {String} sourcePath - path to source image
   * @param {Array<String>} destinationPaths - paths to target devices
   * @returns {ImageWriter} imageWriter
   * @example
   * imageWriter.write(source, destinations)
   *   .on('error', reject)
   *   .on('progress', onProgress)
   *   .on('finish', resolve)
   */
  write (sourcePath, destinationPaths) {

    const source = Image.from(sourcePath)
    const destinations = destinationPaths.map(Image.from)

    // Open the source image / device
    source.open((error) => {

      if (error) {
        this.emit('error', error)
        return
      }

      console.log('Source:', source)
      console.log('')
      console.log('Destinations:', destinations)

      const progressStream = new ProgressStream({
        length: source.metadata.size,
        time: 500
      })

      progressStream.on('progress', (state) => {
        process.stdout.write(`${(state.speed / 1000 / 1000).toFixed(1)} MB/s\n`)
      })

      source.createReadStream((error, readStream) => {
        readStream.pipe(progressStream)
        destinations.forEach((dest) => {
          dest.open((error) => {
            dest.createWriteStream((error, writeStream) => {
              progressStream.pipe(writeStream)
            })
          })
        })
      })

    })

  }

}

module.exports = ImageWriter
