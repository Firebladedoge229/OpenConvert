import base64
import uuid
import os
import asyncio
import shutil
import traceback
import io
from quart import Quart, request, send_file, jsonify
from quart_cors import cors
import pypandoc
from PIL import Image
from pdf2docx import Converter
import ffmpeg
from cryptography.fernet import Fernet
import aiofiles

developmentMode = False
temporaryKey = ""

app = Quart(__name__)
app = cors(app, allow_origin="*")
app.config["MAX_CONTENT_LENGTH"] = 100 * 1024 * 1024

globalSavePath = os.path.join(os.environ.get("TEMP", "/tmp"), "converted_files")
os.makedirs(globalSavePath, exist_ok=True)

ENCRYPTION_KEY = None
if developmentMode:
    ENCRYPTION_KEY = temporaryKey
else:
    ENCRYPTION_KEY = os.environ.get("ENCRYPTION_KEY")

if not ENCRYPTION_KEY:
    key = Fernet.generate_key()
    print(f"Generated encryption key: {key.decode()}")
    raise RuntimeError("Set ENCRYPTION_KEY environment variable before running!")

fernet = Fernet(ENCRYPTION_KEY.encode())

async def clear_global_save_path():
    try:
        for filename in os.listdir(globalSavePath):
            file_path = os.path.join(globalSavePath, filename)
            if os.path.isfile(file_path) or os.path.islink(file_path):
                try:
                    await aiofiles.os.remove(file_path)
                except AttributeError:
                    await asyncio.to_thread(os.remove, file_path)
            elif os.path.isdir(file_path):
                await asyncio.to_thread(shutil.rmtree, file_path)
    except Exception as exception:
        print(f"Failed to clear {globalSavePath}: {exception}")

@app.before_serving
async def startup_cleanup():
    await clear_global_save_path()

def make_temp_filename(ext):
    return os.path.join(globalSavePath, f"{uuid.uuid4()}.{ext}")

async def write_encrypted_file(path, data_bytes):
    encrypted = fernet.encrypt(data_bytes)
    async with aiofiles.open(path, "wb") as f:
        await f.write(encrypted)

async def read_encrypted_file(path):
    async with aiofiles.open(path, "rb") as f:
        encrypted = await f.read()
    return fernet.decrypt(encrypted)

async def decode_base64_to_encrypted_file(b64, filename):
    raw_data = base64.b64decode(b64)
    await write_encrypted_file(filename, raw_data)

async def run_ffmpeg(input_path, output_path):
    def ffmpeg_sync():
        try:
            ffmpeg.input(input_path).output(output_path).run(overwrite_output=True, capture_stdout=True, capture_stderr=True)
        except ffmpeg.Error as e:
            print("FFmpeg failed:")
            print("stdout:", e.stdout.decode("utf-8", errors="ignore") if e.stdout else "<no stdout>")
            print("stderr:", e.stderr.decode("utf-8", errors="ignore") if e.stderr else "<no stderr>")
            raise RuntimeError("FFmpeg conversion failed, check logs for details.") from e
    await asyncio.to_thread(ffmpeg_sync)

async def cleanup_files(files):
    for f in files:
        try:
            if os.path.exists(f):
                try:
                    await aiofiles.os.remove(f)
                except AttributeError:
                    await asyncio.to_thread(os.remove, f)
        except Exception as exception:
            print(f"Cleanup error: {exception}")

def register_cleanup(files, delay=10):
    async def delayed_cleanup():
        await asyncio.sleep(delay)
        await cleanup_files(files)
    asyncio.create_task(delayed_cleanup())

@app.route("/health", methods=["GET"])
@app.route("/status", methods=["GET"])
async def health_check():
    return jsonify(status="ok", message="Service is running"), 200

@app.route("/convert/video", methods=["POST"])
async def convert_video():
    try:
        data = await request.get_json()
        from_fmt = data.get("from")
        to_fmt = data.get("to")
        b64data = data.get("data")

        if not from_fmt or not to_fmt or not b64data:
            return jsonify(error="Missing 'from', 'to', or 'data'"), 400

        from_fmt = from_fmt.lower()
        to_fmt = to_fmt.lower()

        input_enc_file = make_temp_filename(from_fmt)
        output_enc_file = make_temp_filename(to_fmt)
        input_dec_file = make_temp_filename(from_fmt)
        output_dec_file = make_temp_filename(to_fmt)

        await decode_base64_to_encrypted_file(b64data, input_enc_file)

        raw_input = await read_encrypted_file(input_enc_file)
        async with aiofiles.open(input_dec_file, "wb") as f:
            await f.write(raw_input)

        try:
            await run_ffmpeg(input_dec_file, output_dec_file)
        except Exception:
            return jsonify(error="FFmpeg conversion failed, check logs for details."), 500

        async with aiofiles.open(output_dec_file, "rb") as f:
            raw_output = await f.read()
        await write_encrypted_file(output_enc_file, raw_output)

        file_bytes = io.BytesIO(raw_output)
        file_bytes.seek(0)

        response = await send_file(file_bytes, as_attachment=True, attachment_filename=f"converted.{to_fmt}")
        register_cleanup([input_enc_file, input_dec_file, output_enc_file, output_dec_file])
        return response

    except Exception as exception:
        traceback.print_exc()
        return jsonify(error=f"Video conversion failed: {exception}"), 500

@app.route("/convert/document", methods=["POST"])
async def convert_document():
    try:
        data = await request.get_json()
        from_fmt = data.get("from")
        to_fmt = data.get("to")
        b64data = data.get("data")

        if not from_fmt or not to_fmt or not b64data:
            return jsonify(error="Missing 'from', 'to', or 'data'"), 400

        from_fmt = from_fmt.lower()
        to_fmt = to_fmt.lower()

        input_enc_file = make_temp_filename(from_fmt)
        output_enc_file = make_temp_filename(to_fmt)
        input_dec_file = make_temp_filename(from_fmt)
        output_dec_file = make_temp_filename(to_fmt)

        await decode_base64_to_encrypted_file(b64data, input_enc_file)

        raw_input = await read_encrypted_file(input_enc_file)
        async with aiofiles.open(input_dec_file, "wb") as f:
            await f.write(raw_input)

        if from_fmt == "pdf" and to_fmt == "docx":
            def convert_pdf_to_docx():
                converter = Converter(input_dec_file)
                converter.convert(output_dec_file, start=0, end=None)
                converter.close()
            await asyncio.to_thread(convert_pdf_to_docx)
        else:
            await asyncio.to_thread(pypandoc.convert_file, input_dec_file, to_fmt, outputfile=output_dec_file)

        async with aiofiles.open(output_dec_file, "rb") as f:
            raw_output = await f.read()
        await write_encrypted_file(output_enc_file, raw_output)

        file_bytes = io.BytesIO(raw_output)
        file_bytes.seek(0)

        response = await send_file(file_bytes, as_attachment=True, attachment_filename=f"converted.{to_fmt}")
        register_cleanup([input_enc_file, input_dec_file, output_enc_file, output_dec_file])
        return response

    except Exception as exception:
        traceback.print_exc()
        return jsonify(error=f"Document conversion failed: {exception}"), 500

@app.route("/convert/image", methods=["POST"])
async def convert_image():
    try:
        data = await request.get_json()
        b64data = data.get("data")
        from_ext = data.get("from")
        to_ext = data.get("to")

        if not from_ext or not to_ext or not b64data:
            return jsonify(error="Missing 'from', 'to', or 'data'"), 400

        from_ext = from_ext.lower()
        to_ext = to_ext.lower()

        raw_input = base64.b64decode(b64data)

        input_enc_file = make_temp_filename(from_ext)
        await write_encrypted_file(input_enc_file, raw_input)

        decrypted_input = await read_encrypted_file(input_enc_file)
        input_buffer = io.BytesIO(decrypted_input)

        output_buffer = io.BytesIO()

        def pil_convert():
            with Image.open(input_buffer) as img:
                if to_ext in ["jpeg", "jpg", "eps", "pcx"] and img.mode in ("RGBA", "LA"):
                    background = Image.new("RGB", img.size, (255, 255, 255))
                    background.paste(img, mask=img.split()[-1])
                    background.save(output_buffer, to_ext.upper())
                elif to_ext == "xbm":
                    gray_img = img.convert("L")
                    inverted_img = ImageOps.invert(gray_img)
                    bw_img = inverted_img.convert("1")
                    bw_img.save(output_buffer, "XBM")
                else:
                    img.save(output_buffer, to_ext.upper())
            output_buffer.seek(0)

        await asyncio.to_thread(pil_convert)

        output_enc_file = make_temp_filename(to_ext)
        await write_encrypted_file(output_enc_file, output_buffer.getvalue())

        response_buffer = io.BytesIO(output_buffer.getvalue())
        response_buffer.seek(0)

        register_cleanup([input_enc_file, output_enc_file])

        return await send_file(
            response_buffer,
            as_attachment=True,
            attachment_filename=f"converted.{to_ext}"
        )

    except Exception as exception:
        traceback.print_exc()
        return jsonify(error=f"Image conversion failed: {exception}"), 500

@app.route("/convert/audio", methods=["POST"])
async def convert_audio():
    try:
        data = await request.get_json()
        from_fmt = data.get("from")
        to_fmt = data.get("to")
        b64data = data.get("data")

        if not from_fmt or not to_fmt or not b64data:
            return jsonify(error="Missing 'from', 'to', or 'data'"), 400

        from_fmt = from_fmt.lower()
        to_fmt = to_fmt.lower()

        input_enc_file = make_temp_filename(from_fmt)
        output_enc_file = make_temp_filename(to_fmt)
        input_dec_file = make_temp_filename(from_fmt)
        output_dec_file = make_temp_filename(to_fmt)

        await decode_base64_to_encrypted_file(b64data, input_enc_file)

        raw_input = await read_encrypted_file(input_enc_file)
        async with aiofiles.open(input_dec_file, "wb") as f:
            await f.write(raw_input)

        try:
            await run_ffmpeg(input_dec_file, output_dec_file)
        except Exception:
            return jsonify(error="FFmpeg conversion failed, check logs for details."), 500

        async with aiofiles.open(output_dec_file, "rb") as f:
            raw_output = await f.read()
        await write_encrypted_file(output_enc_file, raw_output)

        file_bytes = io.BytesIO(raw_output)
        file_bytes.seek(0)

        response = await send_file(file_bytes, as_attachment=True, attachment_filename=f"converted.{to_fmt}")
        register_cleanup([input_enc_file, input_dec_file, output_enc_file, output_dec_file])
        return response

    except Exception as exception:
        traceback.print_exc()
        return jsonify(error=f"Audio conversion failed: {exception}"), 500

if __name__ == "__main__":
    import hypercorn.asyncio
    import hypercorn.config

    config = hypercorn.config.Config()
    config.bind = ["0.0.0.0:10000"]
    asyncio.run(hypercorn.asyncio.serve(app, config))
