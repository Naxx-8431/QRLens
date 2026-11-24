package com.mnx.qrlens;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;

/**
 * Saves images to Pictures/QRLens, where the Gallery and file managers can see them.
 *
 * Android 10+ goes through MediaStore and needs no permission. Older versions
 * write the file directly, which needs WRITE_EXTERNAL_STORAGE, and then ask the
 * media scanner to index it.
 */
@CapacitorPlugin(
    name = "Pictures",
    permissions = { @Permission(alias = "storage", strings = { Manifest.permission.WRITE_EXTERNAL_STORAGE }) }
)
public class PicturesPlugin extends Plugin {

    private static final String ALBUM = "QRLens";

    @PluginMethod
    public void save(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q && getPermissionState("storage") != PermissionState.GRANTED) {
            requestPermissionForAlias("storage", call, "storageResult");
            return;
        }
        write(call);
    }

    @PermissionCallback
    private void storageResult(PluginCall call) {
        if (getPermissionState("storage") == PermissionState.GRANTED) {
            write(call);
        } else {
            call.reject("Storage permission was denied", "DENIED");
        }
    }

    private void write(PluginCall call) {
        String data = call.getString("data");
        String filename = call.getString("filename");
        String mimeType = call.getString("mimeType", "image/png");
        if (data == null || filename == null) {
            call.reject("Missing data or filename");
            return;
        }

        byte[] bytes;
        try {
            bytes = Base64.decode(data, Base64.DEFAULT);
        } catch (IllegalArgumentException e) {
            call.reject("The image data is not valid base64");
            return;
        }

        try {
            String uri = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                ? writeMediaStore(bytes, filename, mimeType)
                : writeLegacy(bytes, filename, mimeType);
            JSObject result = new JSObject();
            result.put("uri", uri);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Could not save the image", e);
        }
    }

    private String writeMediaStore(byte[] bytes, String filename, String mimeType) throws IOException {
        ContentResolver resolver = getContext().getContentResolver();
        ContentValues values = new ContentValues();
        values.put(MediaStore.MediaColumns.DISPLAY_NAME, filename);
        values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
        values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + File.separator + ALBUM);
        values.put(MediaStore.MediaColumns.IS_PENDING, 1);

        Uri collection = MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
        Uri item = resolver.insert(collection, values);
        if (item == null) throw new IOException("MediaStore refused the new image");

        try (OutputStream out = resolver.openOutputStream(item)) {
            if (out == null) throw new IOException("Could not open the new image");
            out.write(bytes);
        } catch (IOException e) {
            resolver.delete(item, null, null);
            throw e;
        }

        values.clear();
        values.put(MediaStore.MediaColumns.IS_PENDING, 0);
        resolver.update(item, values, null, null);
        return item.toString();
    }

    private String writeLegacy(byte[] bytes, String filename, String mimeType) throws IOException {
        Context context = getContext();
        File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES), ALBUM);
        if (!dir.isDirectory() && !dir.mkdirs()) throw new IOException("Could not create " + dir);

        File file = new File(dir, filename);
        try (FileOutputStream out = new FileOutputStream(file)) {
            out.write(bytes);
        }
        MediaScannerConnection.scanFile(context, new String[] { file.getAbsolutePath() }, new String[] { mimeType }, null);
        return Uri.fromFile(file).toString();
    }
}
