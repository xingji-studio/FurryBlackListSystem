from blacklist_site.admin_app import create_admin_app
from blacklist_site.config import get_admin_port


app = create_admin_app()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=get_admin_port(), debug=False)
