/*
 * Copyright 2016 resin.io
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

const sdk = require('etcher-sdk')
const process = require('process')

const settings = require('../models/settings')

function includeSystemDrives() {
  return settings.get('unsafeMode') && !settings.get('disableUnsafeMode')
}

const adapters = [
  new sdk.scanner.adapters.BlockDeviceAdapter(includeSystemDrives)
]

// Can't use permissions.isElevated() here as it returns a promise and we need to set
// module.exports = scanner right now.
if ((process.platform !== 'linux') || (process.geteuid() === 0)) {
  adapters.push(new sdk.scanner.adapters.UsbbootDeviceAdapter())
}

const scanner = new sdk.scanner.Scanner(adapters)

module.exports = scanner
