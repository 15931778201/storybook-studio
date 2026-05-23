import { describe, expect, it } from 'bun:test';
import {
  buildUploadedImageAttachment,
  buildImageStreamParams,
} from '../web/src/utils/chat-upload';
import {
  getAutoScrollState,
} from '../web/src/utils/chat-scroll';

describe('chat upload and scroll helpers', () => {
  it('uses the uploaded temp path for image stream params without requiring a second upload', () => {
    const attachment = buildUploadedImageAttachment({
      success: true,
      dataUri: 'data:image/jpeg;base64,abc123',
      tempPath: '/tmp/agent-image.jpg',
    });

    expect(attachment).toEqual({
      previewUrl: 'data:image/jpeg;base64,abc123',
      tempPath: '/tmp/agent-image.jpg',
    });
    expect(buildImageStreamParams(attachment)).toEqual({ imageRef: '/tmp/agent-image.jpg' });
  });

  it('keeps the reader position when the user has scrolled away from the bottom', () => {
    expect(getAutoScrollState({
      scrollTop: 200,
      clientHeight: 400,
      scrollHeight: 1200,
    })).toEqual({ shouldAutoScroll: false, showNewOutput: true });
  });

  it('auto-scrolls only when the reader is already near the bottom', () => {
    expect(getAutoScrollState({
      scrollTop: 760,
      clientHeight: 400,
      scrollHeight: 1200,
    })).toEqual({ shouldAutoScroll: true, showNewOutput: false });
  });
});
