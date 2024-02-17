# Change Log

All notable changes to the "rustup" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

- Uses a Progress Notification during checkUpdates command and when responding to the button.
- All children stdout/stderr forwarded into a "rustup" Output Window.

## 1.0.2

- Retrieves workspace folder containing active text editor file uri for override instead of setting it for `/`.

## 1.0.1

- Actually starts checking for updates.

## 1.0.0

- Initial release. Checks for updates once an hour. Allows overriding the workspace toolchain.