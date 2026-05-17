from blacklist_site.config import get_public_port
from blacklist_site.public_app import create_public_app


app = create_public_app()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=get_public_port(), debug=False)
